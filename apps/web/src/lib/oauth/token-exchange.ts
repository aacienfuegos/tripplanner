import "server-only";
import { prisma } from "@/lib/prisma";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_MS, type OAuthConfig } from "@/lib/oauth/config";
import { isInactive, revokeGrant, type TxClient } from "@/lib/oauth/grants";
import { generateSecret, secretHash, verifyPkce } from "@/lib/oauth/tokens";

export type TokenErrorCode =
  | "invalid_request"
  | "invalid_grant"
  | "invalid_client"
  | "invalid_target"
  | "unsupported_grant_type";

export type TokenResponse = {
  readonly access_token: string;
  readonly token_type: "Bearer";
  readonly expires_in: number;
  readonly refresh_token?: string;
  readonly scope: string;
};

export type TokenResult = { readonly ok: true; readonly body: TokenResponse } | { readonly ok: false; readonly error: TokenErrorCode };

const fail = (error: TokenErrorCode): TokenResult => ({ ok: false, error });

const MAX_BODY_BYTES = 8 * 1024;

// Counts the bytes as they arrive and stops at the limit: a chunked body has
// no Content-Length, and Next puts no cap on Route Handlers.
async function readCapped(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        reader.cancel().catch(() => {});
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
  } catch {
    return null;
  }
}

// application/x-www-form-urlencoded, small, and each parameter at most once
// (RFC 6749, section 3.2).
export async function readForm(request: Request): Promise<URLSearchParams | null> {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/x-www-form-urlencoded\s*(;|$)/i.test(type)) return null;
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return null;
  const text = await readCapped(request);
  if (text === null) return null;
  const params = new URLSearchParams(text);
  for (const key of new Set(params.keys())) {
    if (params.getAll(key).length > 1) return null;
  }
  return params;
}

type GrantForCheck = {
  readonly id: string;
  readonly scopes: readonly string[];
  readonly revokedAt: Date | null;
  readonly lastUsedAt: Date;
  readonly client: { readonly clientId: string; readonly deletedAt: Date | null };
  readonly user: { readonly status: string };
};

const grantInclude = {
  grant: {
    include: {
      client: { select: { clientId: true, deletedAt: true } },
      user: { select: { status: true } },
    },
  },
} as const;

// Checks that consume nothing. A connection found inactive is marked here.
async function checkGrant(grant: GrantForCheck, clientId: string, now: Date): Promise<TokenErrorCode | null> {
  if (grant.client.clientId !== clientId) return "invalid_grant";
  if (grant.client.deletedAt) return "invalid_client";
  if (grant.revokedAt || grant.user.status !== "APPROVED") return "invalid_grant";
  if (isInactive(grant.lastUsedAt, now)) {
    await revokeGrant(prisma, grant.id, "INACTIVE", now);
    return "invalid_grant";
  }
  return null;
}

// Only hashes go to the database; the values go back to the client once.
async function issueTokens(tx: TxClient, grant: GrantForCheck, resource: string, now: Date): Promise<TokenResponse> {
  const access = generateSecret("tpat_");
  const refresh = grant.scopes.includes("offline_access") ? generateSecret("tprt_") : null;
  await tx.oAuthToken.deleteMany({ where: { grantId: grant.id, expiresAt: { lt: now } } });
  await tx.oAuthToken.createMany({
    data: [
      {
        tokenHash: secretHash(access),
        kind: "ACCESS",
        grantId: grant.id,
        resource,
        expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000),
      },
      ...(refresh
        ? [
            {
              tokenHash: secretHash(refresh),
              kind: "REFRESH" as const,
              grantId: grant.id,
              resource,
              expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
            },
          ]
        : []),
    ],
  });
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    ...(refresh ? { refresh_token: refresh } : {}),
    scope: grant.scopes.join(" "),
  };
}

type ExchangeInput = {
  readonly code: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly codeVerifier: string;
  readonly resource: string | null;
};

export async function exchangeCode(config: OAuthConfig, input: ExchangeInput, now: Date): Promise<TokenResult> {
  const codeHash = secretHash(input.code);
  const row = await prisma.oAuthCode.findUnique({ where: { codeHash }, include: grantInclude });
  if (!row) return fail("invalid_grant");
  const grantError = await checkGrant(row.grant, input.clientId, now);
  if (grantError) return fail(grantError);
  if (row.redirectUri !== input.redirectUri) return fail("invalid_grant");
  if (input.resource !== null && input.resource !== row.resource) return fail("invalid_target");
  if (row.resource !== config.resource) return fail("invalid_target");
  if (!verifyPkce(input.codeVerifier, row.codeChallenge)) return fail("invalid_grant");

  return prisma.$transaction(async (tx): Promise<TokenResult> => {
    const { count } = await tx.oAuthCode.updateMany({
      where: { codeHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (count !== 1) {
      // Still within its lifetime, so it was used: a replayed code.
      if (row.expiresAt > now) await revokeGrant(tx, row.grantId, "TOKEN_REUSE", now);
      return fail("invalid_grant");
    }
    return { ok: true, body: await issueTokens(tx, row.grant, row.resource, now) };
  });
}

type RefreshInput = { readonly refreshToken: string; readonly clientId: string; readonly resource: string | null };

// Strict rotation: a refresh token works once, and one already spent revokes
// the whole connection with all its tokens (CA4).
export async function rotateRefreshToken(config: OAuthConfig, input: RefreshInput, now: Date): Promise<TokenResult> {
  const tokenHash = secretHash(input.refreshToken);
  const row = await prisma.oAuthToken.findUnique({ where: { tokenHash }, include: grantInclude });
  if (!row || row.kind !== "REFRESH") return fail("invalid_grant");
  const grantError = await checkGrant(row.grant, input.clientId, now);
  if (grantError) return fail(grantError);
  if (input.resource !== null && input.resource !== row.resource) return fail("invalid_target");
  if (row.resource !== config.resource) return fail("invalid_target");

  return prisma.$transaction(async (tx): Promise<TokenResult> => {
    const { count } = await tx.oAuthToken.updateMany({
      where: { tokenHash, kind: "REFRESH", usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (count !== 1) {
      if (row.expiresAt > now) await revokeGrant(tx, row.grantId, "TOKEN_REUSE", now);
      return fail("invalid_grant");
    }
    return { ok: true, body: await issueTokens(tx, row.grant, row.resource, now) };
  });
}
