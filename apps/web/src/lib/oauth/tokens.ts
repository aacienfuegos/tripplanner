import { createHash, randomBytes } from "node:crypto";
import { timingSafeStringEqual } from "@/lib/timing-safe";

// Prefixes so that secret scanners recognise them: code, access and refresh.
export type SecretPrefix = "tpac_" | "tpat_" | "tprt_";

export function generateSecret(prefix: SecretPrefix): string {
  return prefix + randomBytes(32).toString("base64url");
}

// The public id of a manually registered client: shown, not secret.
export function generateClientId(): string {
  return "tpc_" + randomBytes(16).toString("base64url");
}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

// What the database keeps instead of the value. It is computed before any
// query, so the value never reaches Prisma, its errors or a log.
export function secretHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const CODE_VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;
const CODE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

export function isCodeChallenge(value: string): boolean {
  return CODE_CHALLENGE.test(value);
}

// RFC 7636, S256 only. The one direct comparison of a secret in the flow, so
// it is constant time.
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!CODE_VERIFIER.test(verifier)) return false;
  const computed = createHash("sha256").update(verifier).digest("base64url");
  return timingSafeStringEqual(computed, challenge);
}
