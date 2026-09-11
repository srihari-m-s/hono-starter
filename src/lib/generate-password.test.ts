import { describe, expect, test } from "bun:test";
import { generatePassword } from "./generate-password";

describe("generatePassword", () => {
  test("returns 12 characters by default", () => {
    expect(generatePassword()).toHaveLength(12);
  });

  test("honors a custom length", () => {
    expect(generatePassword(20)).toHaveLength(20);
  });

  test("contains at least one lowercase, uppercase, number and special char", () => {
    const password = generatePassword(16);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[^a-zA-Z0-9]/);
  });

  test("throws for lengths below 4", () => {
    expect(() => generatePassword(3)).toThrow();
  });

  test("produces different passwords across calls", () => {
    expect(generatePassword()).not.toBe(generatePassword());
  });
});