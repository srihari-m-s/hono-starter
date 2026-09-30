import { describe, expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword", () => {
  test("produces an argon2id hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  test("never returns the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse battery staple");
  });

  test("salts: the same password hashes differently every time", async () => {
    const [first, second] = await Promise.all([
      hashPassword("same-password"),
      hashPassword("same-password"),
    ]);

    expect(first).not.toBe(second);
  });
});

describe("verifyPassword", () => {
  test("accepts the correct password", async () => {
    const hash = await hashPassword("s3cret-passphrase");
    expect(await verifyPassword("s3cret-passphrase", hash)).toBe(true);
  });

  test("rejects the wrong password", async () => {
    const hash = await hashPassword("s3cret-passphrase");
    expect(await verifyPassword("s3cret-passphras", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });
});
