import { describe, expect, test } from "bun:test";
import { comparePassword, hashPassword } from "./protect-password";

describe("hashPassword / comparePassword", () => {
  test("hashes a password and verifies it", async () => {
    const hash = await hashPassword("S3cret!Pass");
    expect(hash).not.toBe("S3cret!Pass");
    await expect(comparePassword("S3cret!Pass", hash)).resolves.toBe(true);
  });

  test("rejects a wrong password", async () => {
    const hash = await hashPassword("S3cret!Pass");
    await expect(comparePassword("wrong", hash)).resolves.toBe(false);
  });

  test("generates a unique salt per hash", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});