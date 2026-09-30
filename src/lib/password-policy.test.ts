import { describe, expect, test } from "bun:test";
import {
  checkPassword,
  isCommonPassword,
  PASSWORD_REJECTION_MESSAGES,
} from "./password-policy";

describe("isCommonPassword", () => {
  test("blocks entries from the bundled list, including numeric ones", () => {
    for (const password of ["password", "123456", "qwerty", "letmein"]) {
      expect(isCommonPassword(password)).toBe(true);
    }
  });

  test("is case-insensitive", () => {
    expect(isCommonPassword("PaSsWoRd")).toBe(true);
  });

  test("blocks trivial modifications of a common password", () => {
    // NIST asks for guidance that "discourages trivial modifications of listed
    // weak passwords" — these are the shapes users actually produce.
    for (const password of [
      "Password1",
      "password1!",
      "Password123",
      "p@ssw0rd",
      "P@ssword!",
      "letmein123",
    ]) {
      expect(isCommonPassword(password)).toBe(true);
    }
  });

  test("does not block a long passphrase that merely contains a weak word", () => {
    // NIST: "The entire password SHALL be subject to comparison, not substrings
    // or words that might be contained therein."
    for (const password of [
      "my password is a long phrase",
      "the quick brown fox jumps",
      "passwordlessisthewayforward",
    ]) {
      expect(isCommonPassword(password)).toBe(false);
    }
  });

  test("does not block an unrelated strong passphrase", () => {
    for (const password of [
      "correct horse battery staple",
      "brimstone-quillon-vex",
      "9f4b2c7e1a83d605",
    ]) {
      expect(isCommonPassword(password)).toBe(false);
    }
  });

  test("blocks a password built from the caller's own details", () => {
    expect(
      isCommonPassword("ada@example.com", { email: "ada@example.com" }),
    ).toBe(true);
    expect(isCommonPassword("ada123", { email: "ada@example.com" })).toBe(true);
    expect(isCommonPassword("lovelace", { firstName: "Lovelace" })).toBe(true);
  });

  test("blocks a password built from the service name", () => {
    expect(isCommonPassword("hono-starter")).toBe(true);
    expect(isCommonPassword("honostarter123")).toBe(true);
  });

  test("does not block a real passphrase that merely starts with a name", () => {
    // Only whole-string matches count, so a name used as a prefix is fine.
    expect(
      isCommonPassword("adalovelacewrotethefirstalgorithm", {
        firstName: "Ada",
        lastName: "Lovelace",
      }),
    ).toBe(false);
  });
});

describe("checkPassword", () => {
  test("returns null for an acceptable password", async () => {
    expect(await checkPassword("a-long-enough-passphrase")).toBeNull();
  });

  test("reports the reason a password was rejected", async () => {
    expect(await checkPassword("password123")).toBe("common");
  });

  test("passes caller context through to the check", async () => {
    expect(
      await checkPassword("someones-email-address", {
        email: "someones-email-address@example.com",
      }),
    ).toBe("common");
  });

  test("every rejection reason has a message for the client", () => {
    for (const message of Object.values(PASSWORD_REJECTION_MESSAGES)) {
      expect(message.length).toBeGreaterThan(10);
    }
  });

  test("does not reach the network when breach lookup is off", async () => {
    // The test suite runs with PASSWORD_BREACH_LOOKUP=off, so this stays
    // hermetic. `fetch` is replaced to prove no call is attempted.
    const originalFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = (() => {
      called = true;
      return Promise.reject(new Error("network access in test"));
    }) as unknown as typeof fetch;

    try {
      expect(await checkPassword("a-long-enough-passphrase")).toBeNull();
      expect(await checkPassword("password123")).toBe("common");
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(called).toBe(false);
  });
});
