// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { LookupAddress } from "node:dns";

vi.mock("node:dns", () => ({ lookup: vi.fn() }));
vi.mock("node:https", () => ({ request: vi.fn() }));

import { lookup } from "node:dns";
import { request } from "node:https";
import {
  CimdError,
  fetchClientMetadata,
  guardedLookup,
  isPublicAddress,
  parseCimdUrl,
} from "@/lib/oauth/cimd";

const CLIENT_ID = "https://agents.example.com/oauth/client.json";
const DOCUMENT = {
  client_id: CLIENT_ID,
  client_name: "Paperclip",
  redirect_uris: ["https://agents.example.com/oauth/callback"],
  token_endpoint_auth_method: "none",
};

function resolvesTo(addresses: readonly LookupAddress[]) {
  vi.mocked(lookup).mockImplementation(((_host: string, _options: unknown, callback: (e: null, a: readonly LookupAddress[]) => void) =>
    callback(null, addresses)) as unknown as typeof lookup);
}

function runLookup(): Promise<{ error: unknown; address: unknown }> {
  return new Promise((resolve) => {
    guardedLookup("agents.example.com", { all: true }, (error, address) => resolve({ error, address }));
  });
}

type Reply = { status: number; headers?: Record<string, string>; body?: string };

// A fake https.request: answers once end() is called, unless `reply` is null.
function serve(reply: Reply | null) {
  const destroy = vi.fn();
  vi.mocked(request).mockImplementation(((_url: URL, _options: unknown, callback: (res: unknown) => void) => {
    const req = Object.assign(new EventEmitter(), {
      destroy,
      end: () => {
        if (!reply) return;
        queueMicrotask(() => {
          const res = Object.assign(new PassThrough(), { statusCode: reply.status, headers: reply.headers ?? {} });
          callback(res);
          res.end(reply.body ?? "");
        });
      },
    });
    return req;
  }) as unknown as typeof request);
  return { destroy };
}

const json = { "content-type": "application/json; charset=utf-8" };

beforeEach(() => {
  vi.mocked(lookup).mockReset();
  vi.mocked(request).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isPublicAddress", () => {
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700::1111", "2001:4860:4860::8888"])("lets %s through", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:8.8.8.8",
    "64:ff9b::a00:1",
    "2001:db8::1",
    "2002::1",
    "fd00::1",
    "fe80::1",
    "ff02::1",
    "not-an-ip",
  ])("blocks %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
});

describe("parseCimdUrl", () => {
  it("accepts an https URL on 443 with a path", () => {
    expect(parseCimdUrl(CLIENT_ID)?.href).toBe(CLIENT_ID);
    expect(parseCimdUrl("https://8.8.8.8/client.json")).not.toBeNull();
  });

  it.each([
    "http://agents.example.com/client.json",
    "https://agents.example.com:8443/client.json",
    "https://agents.example.com:443/client.json",
    "https://agents.example.com/",
    "https://user@agents.example.com/client.json",
    "https://agents.example.com/client.json#x",
    "https://10.0.0.5/client.json",
    "https://[::1]/client.json",
    "https://[::ffff:127.0.0.1]/client.json",
    "https://0.0.0.0/client.json",
    "https://AGENTS.example.com/client.json",
  ])("rejects %s", (url) => {
    expect(parseCimdUrl(url)).toBeNull();
  });
});

describe("guardedLookup (CA24)", () => {
  it("passes the addresses on when all of them are global", async () => {
    resolvesTo([
      { address: "8.8.8.8", family: 4 },
      { address: "2606:4700::1111", family: 6 },
    ]);
    const { error, address } = await runLookup();
    expect(error).toBeNull();
    expect(address).toHaveLength(2);
  });

  it.each([
    [[{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }]],
    [[{ address: "0.0.0.0", family: 4 }]],
    [[{ address: "::ffff:127.0.0.1", family: 6 }]],
    [[]],
  ])("refuses the connection if any address is not global: %j", async (addresses) => {
    resolvesTo(addresses);
    const { error } = await runLookup();
    expect(error).toBeInstanceOf(CimdError);
    expect((error as CimdError).reason).toBe("blocked_address");
  });
});

describe("fetchClientMetadata", () => {
  it("fetches and validates the document, with the guarded lookup and no agent", async () => {
    serve({ status: 200, headers: json, body: JSON.stringify(DOCUMENT) });
    await expect(fetchClientMetadata(CLIENT_ID)).resolves.toEqual({
      name: "Paperclip",
      redirectUris: ["https://agents.example.com/oauth/callback"],
    });
    const options = vi.mocked(request).mock.calls[0][1] as unknown as Record<string, unknown>;
    expect(options.lookup).toBe(guardedLookup);
    expect(options.agent).toBe(false);
  });

  it.each([
    "http://agents.example.com/client.json",
    "https://192.168.1.10/client.json",
    "https://agents.example.com:8443/client.json",
  ])("rejects %s without asking for it (CA24)", async (clientId) => {
    await expect(fetchClientMetadata(clientId)).rejects.toMatchObject({ reason: "invalid_url" });
    expect(request).not.toHaveBeenCalled();
  });

  it("does not follow a redirect (CA24)", async () => {
    const { destroy } = serve({ status: 302, headers: { location: "https://10.0.0.1/x" } });
    await expect(fetchClientMetadata(CLIENT_ID)).rejects.toMatchObject({ reason: "redirect" });
    expect(request).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalled();
  });

  it("surfaces the lookup refusal as the error of the request", async () => {
    vi.mocked(request).mockImplementation(((_url: URL, _options: unknown) => {
      const req = Object.assign(new EventEmitter(), {
        destroy: vi.fn(),
        end: () => queueMicrotask(() => req.emit("error", new CimdError("blocked_address"))),
      });
      return req;
    }) as unknown as typeof request);
    await expect(fetchClientMetadata(CLIENT_ID)).rejects.toMatchObject({ reason: "blocked_address" });
  });

  it("stops at 64 KB", async () => {
    serve({ status: 200, headers: json, body: " ".repeat(65 * 1024) });
    await expect(fetchClientMetadata(CLIENT_ID)).rejects.toMatchObject({ reason: "too_large" });
  });

  it("gives up after 5 seconds", async () => {
    vi.useFakeTimers();
    const { destroy } = serve(null);
    const pending = fetchClientMetadata(CLIENT_ID);
    const settled = expect(pending).rejects.toMatchObject({ reason: "timeout" });
    await vi.advanceTimersByTimeAsync(5000);
    await settled;
    expect(destroy).toHaveBeenCalled();
  });

  it.each([
    ["not JSON", { status: 200, headers: { "content-type": "text/html" }, body: "<html>" }, "content_type"],
    ["an error status", { status: 404, headers: json, body: "{}" }, "http_status"],
    ["broken JSON", { status: 200, headers: json, body: "{" }, "invalid_json"],
    ["another client_id", { status: 200, headers: json, body: JSON.stringify({ ...DOCUMENT, client_id: "https://evil.example/c.json" }) }, "invalid_document"],
    ["an http redirect URI", { status: 200, headers: json, body: JSON.stringify({ ...DOCUMENT, redirect_uris: ["http://agents.example.com/cb"] }) }, "invalid_document"],
    ["a client secret method", { status: 200, headers: json, body: JSON.stringify({ ...DOCUMENT, token_endpoint_auth_method: "client_secret_basic" }) }, "invalid_document"],
  ])("rejects %s", async (_label, reply, reason) => {
    serve(reply);
    await expect(fetchClientMetadata(CLIENT_ID)).rejects.toMatchObject({ reason });
  });
});
