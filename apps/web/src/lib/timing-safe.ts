import { createHash, timingSafeEqual } from "node:crypto";

// Hashing both sides to a fixed length before comparing avoids leaking the
// candidate's length via timingSafeEqual (which throws on length mismatch).
export function timingSafeStringEqual(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}
