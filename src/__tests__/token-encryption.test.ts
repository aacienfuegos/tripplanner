import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptToken, decryptToken } from "@/lib/token-encryption";

const TEST_KEY = "4951bb2623393bbc1bd6cbcf2eee73094a34835d6a49b92ced883f06d85a0126";

describe("token-encryption", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("encrypts and decrypts round-trip", () => {
    const original = "ya29.GoogleAccessToken_example";
    const encrypted = encryptToken(original);
    expect(encrypted).not.toBe(original);
    expect(decryptToken(encrypted)).toBe(original);
  });

  it("produces different ciphertext each call (random IV)", () => {
    const token = "same-token";
    expect(encryptToken(token)).not.toBe(encryptToken(token));
  });

  it("decrypts back to original for refresh tokens", () => {
    const refresh = "1//0g-refresh-token-example";
    expect(decryptToken(encryptToken(refresh))).toBe(refresh);
  });

  it("passes through when TOKEN_ENCRYPTION_KEY is not set", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    const token = "plain-token";
    expect(encryptToken(token)).toBe(token);
    expect(decryptToken(token)).toBe(token);
  });

  it("returns value as-is when decryption fails (plaintext in DB)", () => {
    const plaintext = "not-encrypted-legacy-token";
    expect(decryptToken(plaintext)).toBe(plaintext);
  });
});
