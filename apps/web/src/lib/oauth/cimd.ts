import { lookup as dnsLookup } from "node:dns";
import { request } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { z } from "zod";
import { MAX_NAME_LENGTH, MAX_URI_LENGTH, isAllowedRedirectUri } from "@/lib/oauth/client-rules";

// Client ID Metadata Documents: the client_id is an https URL whose JSON
// describes the client. Fetching it is the one outbound request that a
// stranger can trigger, so it only goes to global unicast addresses.

const TIMEOUT_MS = 5000;
const MAX_BYTES = 64 * 1024;

// IANA special-purpose ranges.
const BLOCKED_V4: readonly (readonly [string, number])[] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];
const BLOCKED_V6: readonly (readonly [string, number])[] = [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
];

const blocked = new BlockList();
for (const [address, prefix] of BLOCKED_V4) blocked.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of BLOCKED_V6) blocked.addSubnet(address, prefix, "ipv6");

// ::ffff:0:0/96 goes in a list of its own, checked only for IPv6: in the same
// BlockList, Node matches every IPv4 address against it (8.8.8.8 included).
const ipv4Mapped = new BlockList();
ipv4Mapped.addSubnet("::ffff:0:0", 96, "ipv6");

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  if (family === 6 && ipv4Mapped.check(address, "ipv6")) return false;
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

export type CimdFailure =
  | "invalid_url"
  | "blocked_address"
  | "redirect"
  | "http_status"
  | "content_type"
  | "too_large"
  | "timeout"
  | "invalid_json"
  | "invalid_document"
  | "network";

export class CimdError extends Error {
  constructor(readonly reason: CimdFailure) {
    super(`Client metadata document rejected: ${reason}`);
    this.name = "CimdError";
  }
}

// Only https on 443, with a path, in canonical form (so one document can't be
// two clients). A literal IP goes through the same list: Node does not call
// the lookup for one, it connects straight to it.
export function parseCimdUrl(clientId: string): URL | null {
  if (clientId.length > MAX_URI_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port !== "") return null;
  if (url.username || url.password || url.hash || url.pathname === "/") return null;
  if (url.href !== clientId) return null;
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  if (isIP(host) !== 0 && !isPublicAddress(host)) return null;
  return url;
}

// Every address of the resolution has to be global: with one private among
// public ones, the connection could land on it. The socket then connects to
// the addresses checked here, so a DNS change in between can't slip past.
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { all: true }, (error, addresses) => {
    if (error) {
      callback(error, []);
      return;
    }
    if (addresses.length === 0 || !addresses.every((entry) => isPublicAddress(entry.address))) {
      callback(new CimdError("blocked_address"), []);
      return;
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
};

// No redirects (a 3xx is an error), 5 seconds and 64 KB at most, JSON only.
export function fetchCimdJson(url: URL): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error: CimdError | null, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        req.destroy();
        reject(error);
      } else resolve(value);
    };
    const req = request(
      url,
      { method: "GET", agent: false, lookup: guardedLookup, headers: { accept: "application/json" } },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) return finish(new CimdError("redirect"));
        if (status !== 200) return finish(new CimdError("http_status"));
        if (!/^application\/json\s*(;|$)/i.test(res.headers["content-type"] ?? "")) {
          return finish(new CimdError("content_type"));
        }
        if (Number(res.headers["content-length"] ?? 0) > MAX_BYTES) return finish(new CimdError("too_large"));
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) return finish(new CimdError("too_large"));
          chunks.push(chunk);
        });
        res.on("end", () => {
          try {
            finish(null, JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            finish(new CimdError("invalid_json"));
          }
        });
        res.on("error", () => finish(new CimdError("network")));
      },
    );
    timer = setTimeout(() => finish(new CimdError("timeout")), TIMEOUT_MS);
    req.on("error", (error) => finish(error instanceof CimdError ? error : new CimdError("network")));
    req.end();
  });
}

const documentSchema = z.object({
  client_id: z.string(),
  client_name: z.string().trim().min(1).max(200),
  redirect_uris: z.array(z.string()).min(1).max(20),
  token_endpoint_auth_method: z.literal("none").optional(),
});

export type CimdClient = { readonly name: string; readonly redirectUris: readonly string[] };

export function parseCimdDocument(clientId: string, json: unknown): CimdClient {
  const result = documentSchema.safeParse(json);
  if (!result.success || result.data.client_id !== clientId) throw new CimdError("invalid_document");
  if (!result.data.redirect_uris.every(isAllowedRedirectUri)) throw new CimdError("invalid_document");
  return { name: result.data.client_name.slice(0, MAX_NAME_LENGTH), redirectUris: result.data.redirect_uris };
}

export async function fetchClientMetadata(clientId: string): Promise<CimdClient> {
  const url = parseCimdUrl(clientId);
  if (!url) throw new CimdError("invalid_url");
  return parseCimdDocument(clientId, await fetchCimdJson(url));
}
