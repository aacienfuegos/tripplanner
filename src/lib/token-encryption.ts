import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = "v1:";

function getKey(): Buffer | null {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex) return null;
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  return key;
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  if (!key) {
    console.error("[token-encryption] TOKEN_ENCRYPTION_KEY is not set — storing OAuth token unencrypted");
    return plaintext;
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENCRYPTED_PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(value: string): string | null {
  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    // Unencrypted legacy value — return as-is for migration compatibility
    return value;
  }
  const key = getKey();
  if (!key) {
    console.error("[token-encryption] TOKEN_ENCRYPTION_KEY not set — cannot decrypt stored token");
    return null;
  }
  try {
    const buf = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64");
    if (buf.length <= IV_LENGTH + TAG_LENGTH) return null;
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final("utf8");
  } catch {
    console.error("[token-encryption] Decryption failed — possible key mismatch or corrupted ciphertext");
    return null;
  }
}
