import { describe, expect, test } from "bun:test";
import { loginSchema, signUpUsersSchema } from "./user";

const validSignUp = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  mobile: "9876543210",
};

describe("signUpUsersSchema", () => {
  test("accepts a valid signup payload", () => {
    expect(signUpUsersSchema.safeParse(validSignUp).success).toBe(true);
  });

  test("rejects a firstName shorter than 3 characters", () => {
    const result = signUpUsersSchema.safeParse({
      ...validSignUp,
      firstName: "ab",
    });
    expect(result.success).toBe(false);
  });

  test("rejects an invalid email", () => {
    const result = signUpUsersSchema.safeParse({
      ...validSignUp,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  test("rejects a mobile number shorter than 10 digits", () => {
    const result = signUpUsersSchema.safeParse({
      ...validSignUp,
      mobile: "123",
    });
    expect(result.success).toBe(false);
  });

  test("rejects when required fields are missing", () => {
    expect(signUpUsersSchema.safeParse({}).success).toBe(false);
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
});