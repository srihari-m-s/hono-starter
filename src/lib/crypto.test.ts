import { describe, expect, test } from "bun:test";
import { generateToken, hashToken } from "./crypto";

describe("generateToken", () => {
  test("is URL-safe", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("encodes the requested number of bytes", () => {
    // base64url is 4 characters per 3 bytes, unpadded.
    expect(generateToken(32)).toHaveLength(43);
    expect(generateToken(16)).toHaveLength(22);
  });

  test("does not repeat", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateToken()));
    expect(tokens.size).toBe(500);
  });
});

describe("hashToken", () => {
  test("returns a 64-character hex digest", () => {
    expect(hashToken("some-token")).toMatch(/^[0-9a-f]{64}$/);
  });

  test("is deterministic", () => {
    expect(hashToken("some-token")).toBe(hashToken("some-token"));
  });

  test("does not reveal the input", () => {
    expect(hashToken("some-token")).not.toContain("some-token");
    expect(hashToken("some-token")).not.toBe(hashToken("some-token "));
  });
});
