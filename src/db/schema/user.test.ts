import { describe, expect, test } from "bun:test";
import { loginSchema, signUpUsersSchema } from "./user";

const validSignUp = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  mobile: "9876543210",
  password: "Sup3rSecretPassphrase1",
};

describe("signUpUsersSchema", () => {
  test("accepts a valid signup payload", () => {
    expect(signUpUsersSchema.safeParse(validSignUp).success).toBe(true);
  });

  test("normalises the email to lowercase", () => {
    const result = signUpUsersSchema.safeParse({
      ...validSignUp,
      email: "Ada@Example.COM",
    });

    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("ada@example.com");
  });

  test("ignores fields the server owns", () => {
    const result = signUpUsersSchema.safeParse({
      ...validSignUp,
      role: "admin",
      emailVerifiedAt: new Date().toISOString(),
      id: 99,
    });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("role");
    expect(result.data).not.toHaveProperty("emailVerifiedAt");
    expect(result.data).not.toHaveProperty("id");
  });

  test("rejects a firstName shorter than 3 characters", () => {
    expect(
      signUpUsersSchema.safeParse({ ...validSignUp, firstName: "ab" }).success,
    ).toBe(false);
  });

  test("rejects an invalid email", () => {
    expect(
      signUpUsersSchema.safeParse({ ...validSignUp, email: "not-an-email" })
        .success,
    ).toBe(false);
  });

  test("rejects a mobile number that is not 10-15 digits", () => {
    expect(
      signUpUsersSchema.safeParse({ ...validSignUp, mobile: "123" }).success,
    ).toBe(false);
    expect(
      signUpUsersSchema.safeParse({ ...validSignUp, mobile: "98765abcde" })
        .success,
    ).toBe(false);
  });

  test("rejects when required fields are missing", () => {
    expect(signUpUsersSchema.safeParse({}).success).toBe(false);
  });

  test("requires a password", () => {
    const { password: _password, ...withoutPassword } = validSignUp;
    expect(signUpUsersSchema.safeParse(withoutPassword).success).toBe(false);
  });

  test("enforces the minimum length", () => {
    const tooShort = [
      "short1",
      "alllettersonly", // 14 characters
      "12345678",
      "abcdefghijklmn", // 14 characters
    ];

    for (const password of tooShort) {
      expect(
        signUpUsersSchema.safeParse({ ...validSignUp, password }).success,
      ).toBe(false);
    }
  });

  test("accepts a password of exactly 15 characters", () => {
    expect(
      signUpUsersSchema.safeParse({ ...validSignUp, password: "abcdefghijklmno" })
        .success,
    ).toBe(true);
  });

  test("imposes no character-class composition rules", () => {
    // NIST SP 800-63B-4 §3.1.1: "Verifiers and CSPs SHALL NOT impose other
    // composition rules (e.g., requiring mixtures of different character
    // types) for passwords." Length and the blocklist do the work instead.
    const allowed = [
      "alllettersonlybutlong", // no digits, no symbols
      "123456789012345678", // digits only
      "correct horse battery staple", // spaces
      "!!!!!!!!!!!!!!!!!!!!", // symbols only
    ];

    for (const password of allowed) {
      expect(
        signUpUsersSchema.safeParse({ ...validSignUp, password }).success,
      ).toBe(true);
    }
  });

  test("counts unicode code points, not UTF-16 units", () => {
    const fifteenEmoji = "🔐".repeat(15);
    expect(fifteenEmoji.length).toBe(30); // but only 15 code points

    expect(
      signUpUsersSchema.safeParse({ ...validSignUp, password: fifteenEmoji })
        .success,
    ).toBe(true);
    expect(
      signUpUsersSchema.safeParse({ ...validSignUp, password: "🔐".repeat(14) })
        .success,
    ).toBe(false);
  });

  test("rejects a password longer than 128 characters", () => {
    expect(
      signUpUsersSchema.safeParse({ ...validSignUp, password: "a".repeat(129) })
        .success,
    ).toBe(false);
  });
});

describe("loginSchema", () => {
  test("accepts an email identifier", () => {
    expect(
      loginSchema.safeParse({ identifier: "ada@example.com", password: "x" })
        .success,
    ).toBe(true);
  });

  test("accepts a mobile identifier", () => {
    expect(
      loginSchema.safeParse({ identifier: "9876543210", password: "x" })
        .success,
    ).toBe(true);
  });

  test("rejects an empty identifier", () => {
    expect(
      loginSchema.safeParse({ identifier: "", password: "x" }).success,
    ).toBe(false);
  });

  test("rejects an empty password", () => {
    expect(
      loginSchema.safeParse({ identifier: "a@b.com", password: "" }).success,
    ).toBe(false);
  });
});
