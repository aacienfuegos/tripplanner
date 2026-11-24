import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MAX_MANUAL_CLIENTS } from "@/lib/oauth/config";
import { CimdError, fetchClientMetadata, parseCimdUrl } from "@/lib/oauth/cimd";
import { MAX_NAME_LENGTH, MAX_URI_LENGTH, isAllowedRedirectUri } from "@/lib/oauth/client-rules";
import { lockUser } from "@/lib/oauth/grants";
import { generateClientId } from "@/lib/oauth/tokens";

const CIMD_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MANUAL_CLIENT_ID = /^tpc_[A-Za-z0-9_-]{22}$/;

// A client the authorization request can use. `id` is null for a CIMD
// document fetched in this request and not stored yet: it is stored only when
// the whole request passes validation.
export type KnownClient = {
  readonly id: string | null;
  readonly clientId: string;
  readonly kind: "MANUAL" | "CIMD";
  readonly name: string;
  readonly redirectUris: readonly string[];
  readonly ownerUserId: string | null;
  readonly createdAt: Date;
};

export async function resolveClient(clientId: string, now: Date): Promise<KnownClient | null> {
  if (MANUAL_CLIENT_ID.test(clientId)) {
    const stored = await prisma.oAuthClient.findUnique({ where: { clientId } });
    if (!stored || stored.kind !== "MANUAL" || stored.deletedAt) return null;
    return stored;
  }
  if (!parseCimdUrl(clientId)) return null;
  const stored = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (stored && (stored.kind !== "CIMD" || stored.deletedAt)) return null;
  const fresh = stored?.metadataFetchedAt && now.getTime() - stored.metadataFetchedAt.getTime() < CIMD_MAX_AGE_MS;
  if (stored && fresh) return stored;
  try {
    const document = await fetchClientMetadata(clientId);
    return {
      id: null,
      clientId,
      kind: "CIMD",
      name: document.name,
      redirectUris: document.redirectUris,
      ownerUserId: null,
      createdAt: stored?.createdAt ?? now,
    };
  } catch (error) {
    if (error instanceof CimdError) return null;
    throw error;
  }
}

// Stores (or refreshes) a CIMD client once its request has passed validation.
export async function saveClient(client: KnownClient, now: Date): Promise<string> {
  if (client.id) return client.id;
  const data = { name: client.name, redirectUris: [...client.redirectUris], metadataFetchedAt: now };
  const saved = await prisma.oAuthClient.upsert({
    where: { clientId: client.clientId },
    create: { clientId: client.clientId, kind: "CIMD", ...data },
    update: data,
    select: { id: true },
  });
  return saved.id;
}

export const manualClientSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  redirectUri: z.string().trim().max(MAX_URI_LENGTH).refine(isAllowedRedirectUri),
});

export type CreateClientResult =
  | { readonly ok: true; readonly clientId: string }
  | { readonly ok: false; readonly error: "invalid_name" | "invalid_redirect_uri" | "limit" };

export async function createManualClient(userId: string, input: unknown): Promise<CreateClientResult> {
  const parsed = manualClientSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { ok: false, error: field === "name" ? "invalid_name" : "invalid_redirect_uri" };
  }
  return prisma.$transaction(async (tx): Promise<CreateClientResult> => {
    await lockUser(tx, userId);
    const count = await tx.oAuthClient.count({ where: { ownerUserId: userId, deletedAt: null } });
    if (count >= MAX_MANUAL_CLIENTS) return { ok: false, error: "limit" };
    const created = await tx.oAuthClient.create({
      data: {
        clientId: generateClientId(),
        kind: "MANUAL",
        name: parsed.data.name,
        redirectUris: [parsed.data.redirectUri],
        ownerUserId: userId,
      },
      select: { clientId: true },
    });
    return { ok: true, clientId: created.clientId };
  });
}
