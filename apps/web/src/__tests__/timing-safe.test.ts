import { describe, it, expect } from "vitest";
import { timingSafeStringEqual } from "@/lib/timing-safe";

describe("timingSafeStringEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeStringEqual("admin123", "admin123")).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(timingSafeStringEqual("admin123", "admin124")).toBe(false);
  });

  it("returns false for strings of different lengths without throwing", () => {
    expect(() => timingSafeStringEqual("short", "a-much-longer-candidate-value")).not.toThrow();
    expect(timingSafeStringEqual("short", "a-much-longer-candidate-value")).toBe(false);
  });

  it("returns false when comparing an empty string against a non-empty one", () => {
    expect(timingSafeStringEqual("", "nonempty")).toBe(false);
  });

  it("returns true for two empty strings", () => {
    expect(timingSafeStringEqual("", "")).toBe(true);
  });
});
