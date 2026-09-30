import { z } from "@hono/zod-openapi";
import {
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const userRoles = ["user", "admin"] as const;
export type UserRole = (typeof userRoles)[number];
export const userRoleEnum = pgEnum("user_role", userRoles);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  email: text("email").notNull().unique(),
  mobile: text("mobile").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  /**
   * Null until the address is confirmed through the emailed token. A user
   * cannot log in while this is null.
   */
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: "string" }),
  // `withTimezone` matters: a timezone-less `timestamp` stores wall-clock time,
  // so a value written on a non-UTC machine reads back shifted, and comparing
  // it against `now()` silently fails. Every timestamp in this schema keeps the
  // offset so the value means the same instant everywhere.
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .$onUpdateFn(() => new Date().toISOString())
    .notNull(),
});

/**
 * Columns that are safe to return over the API. Every response shape and
 * every `select()` that feeds a response should go through this so the
 * password hash can never leak by accident.
 */
export const publicUserColumns = {
  id: usersTable.id,
  firstName: usersTable.firstName,
  lastName: usersTable.lastName,
  email: usersTable.email,
  mobile: usersTable.mobile,
  role: usersTable.role,
  emailVerifiedAt: usersTable.emailVerifiedAt,
  createdAt: usersTable.createdAt,
  updatedAt: usersTable.updatedAt,
};

const fullSelectUsersSchema = createSelectSchema(usersTable);

export const selectUsersSchema = fullSelectUsersSchema
  .omit({ password: true })
  .openapi("SingleUser");

const insertUsersSchema = createInsertSchema(usersTable, {
  firstName: (s) => s.min(3).max(256),
  mobile: (s) => s.regex(/^[0-9]{10,15}$/, "invalid mobile number"),
  // Normalised on the way in so "Ada@Example.com" and "ada@example.com"
  // cannot become two accounts.
  email: (s) => s.email().toLowerCase(),
});

/** Password policy applied everywhere a password is set or changed. */
export const passwordSchema = z
  .string()
  .refine(
    // NIST counts Unicode code points, not UTF-16 units, so an emoji is one
    // character rather than two.
    (value) => [...value.normalize("NFC")].length >= 15,
    "password must be at least 15 characters",
  )
  .refine(
    (value) => [...value.normalize("NFC")].length <= 128,
    "password must be at most 128 characters",
  );
// Deliberately no character-class rules: NIST SP 800-63B-4 §3.1.1 states
// "Verifiers and CSPs SHALL NOT impose other composition rules (e.g., requiring
// mixtures of different character types)", and OWASP agrees. Length plus the
// blocklist in `src/lib/password-policy.ts` is what does the work instead.
//
// The 15-character floor is the single-factor requirement; 8 would be
// permissible only if passwords were always paired with a second factor, which
// they are not here.

export const signUpUsersSchema = insertUsersSchema
  .pick({
    firstName: true,
    lastName: true,
    email: true,
    mobile: true,
  })
  .extend({
    password: passwordSchema,
  })
  .openapi("UserSignup");

/** Fields a client may change after signup. */
export const patchUserSchema = insertUsersSchema
  .pick({
    firstName: true,
    lastName: true,
    email: true,
    mobile: true,
    role: true,
  })
  .partial()
  .openapi("UserPatch");

export const loginSchema = z
  .object({
    identifier: z.string().min(1),
    password: z.string().min(1),
  })
  .openapi("UserLogin");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
  })
  .openapi("UserChangePassword");

export const accountEmailSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export const forgotPasswordSchema = accountEmailSchema.openapi(
  "UserForgotPassword",
);

export const resendVerificationSchema = accountEmailSchema.openapi(
  "UserResendVerification",
);

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
  })
  .openapi("UserResetPassword");

export const verifyEmailSchema = z
  .object({
    token: z.string().min(1),
  })
  .openapi("UserVerifyEmail");
