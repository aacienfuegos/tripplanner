import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { API_SCOPES, type ApiScopeName } from "@/lib/api-scopes";
import { apiError } from "@/lib/api-http";

const TOKEN_FORMAT = /^tp_[A-Za-z0-9_-]{43}$/;
// RFC 9110 §11.1: el esquema de autenticación no distingue mayúsculas.
const BEARER = /^bearer +(\S+)$/i;
const TOKEN_PREFIX_LENGTH = 10;
export const API_USAGE_RETENTION_DAYS = 90;

// sha256 sin sal: es un secreto de 256 bits generado por el servidor, no una
// contraseña, y se busca por índice único sobre el hash.
export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateApiToken(): { token: string; tokenHash: string; prefix: string } {
  const token = `tp_${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashApiToken(token), prefix: token.slice(0, TOKEN_PREFIX_LENGTH) };
}

export type ApiAuthResult =
  | { ok: true; userId: string; tokenId: string }
  | { ok: false; response: Response; tokenId: string | null };

const unauthorized = (): ApiAuthResult => ({
  ok: false,
  tokenId: null,
  response: apiError(401, "UNAUTHORIZED", "Missing, invalid, revoked or expired token"),
});

export async function authenticateApiRequest(request: Request, scope: ApiScopeName): Promise<ApiAuthResult> {
  const token = BEARER.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token || !TOKEN_FORMAT.test(token)) return unauthorized();

  const record = await prisma.apiToken.findUnique({
    where: { tokenHash: hashApiToken(token) },
    include: { user: { select: { status: true } } },
  });
  if (!record || record.revokedAt || (record.expiresAt && record.expiresAt <= new Date())) {
    return unauthorized();
  }

  if (record.user.status !== "APPROVED" || !record.scopes.includes(API_SCOPES[scope])) {
    return {
      ok: false,
      tokenId: record.id,
      response: apiError(403, "FORBIDDEN", "The token is not allowed to perform this request"),
    };
  }

  return { ok: true, userId: record.userId, tokenId: record.id };
}

// Nombres de los campos escritos y el id del elemento, nunca valores.
export interface ApiAudit {
  fields: string[];
  resourceId: string | null;
}

export async function logApiUsage(
  tokenId: string,
  request: Request,
  status: number,
  audit: ApiAudit,
): Promise<void> {
  await prisma.$transaction([
    prisma.apiTokenUsage.create({
      data: {
        tokenId,
        method: request.method,
        path: new URL(request.url).pathname,
        status,
        fields: audit.fields,
        resourceId: audit.resourceId,
      },
    }),
    prisma.apiToken.update({ where: { id: tokenId }, data: { lastUsedAt: new Date() } }),
  ]);

  const cutoff = new Date(Date.now() - API_USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.apiTokenUsage.deleteMany({ where: { createdAt: { lt: cutoff } } });
}

export interface ApiHandlerContext {
  readonly userId: string;
  readonly audit: ApiAudit;
}

type RouteParams<P> = { params: Promise<P> };

export function withApiToken<P>(
  scope: ApiScopeName,
  handler: (request: Request, ctx: ApiHandlerContext, route: RouteParams<P>) => Promise<Response>,
) {
  return async function apiRoute(request: Request, route: RouteParams<P>): Promise<Response> {
    try {
      const auth = await authenticateApiRequest(request, scope);
      if (!auth.ok) {
        if (auth.tokenId) {
          await logApiUsage(auth.tokenId, request, auth.response.status, { fields: [], resourceId: null });
        }
        return auth.response;
      }

      const audit: ApiAudit = { fields: [], resourceId: null };
      let response: Response;
      try {
        response = await handler(request, { userId: auth.userId, audit }, route);
      } catch (error) {
        console.error("[api/v1]", error);
        response = apiError(500, "INTERNAL", "Internal error");
      }
      await logApiUsage(auth.tokenId, request, response.status, audit);
      return response;
    } catch (error) {
      console.error("[api/v1]", error);
      return apiError(500, "INTERNAL", "Internal error");
    }
  };
}

// A diferencia de requireTripOwner, el userId va en el where y no redirige.
export function findOwnedTrip(tripId: string, userId: string) {
  return prisma.trip.findFirst({ where: { id: tripId, userId }, select: { id: true } });
}

export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}
