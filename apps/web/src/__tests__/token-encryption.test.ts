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
    expect(encrypted.startsWith("v1:")).toBe(true);
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

  it("passes through plaintext when TOKEN_ENCRYPTION_KEY is not set", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    const token = "plain-token";
    expect(encryptToken(token)).toBe(token);
  });

  it("returns legacy plaintext as-is (no v1: prefix = not encrypted)", () => {
    const plaintext = "ya29.legacy-unencrypted-token";
    expect(decryptToken(plaintext)).toBe(plaintext);
  });

  it("returns null for corrupted ciphertext (auth tag mismatch)", () => {
    const encrypted = encryptToken("valid-token");
    const corrupted = encrypted.slice(0, -4) + "XXXX";
    expect(decryptToken(corrupted)).toBeNull();
  });

  it("returns null when key is missing but value looks encrypted", () => {
    const encrypted = encryptToken("token");
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(decryptToken(encrypted)).toBeNull();
  });
});
