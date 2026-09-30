import { db } from "@/db";
import { publicUserColumns, usersTable } from "@/db/schema";
import env from "@/env";
import { createAuthToken } from "@/lib/auth-token";
import { forbiddenResponse, notFoundResponse } from "@/lib/constants";
import { HttpStatusCodes } from "@/lib/http-status-codes";
import { sendEmail, verificationEmail } from "@/lib/mailer";
import type { AppRouteHandler } from "@/lib/types";
import { findPublicUserById, listPublicUsers } from "@/lib/users";
import { eq } from "drizzle-orm";
import type { ListRoute, PatchRoute, ReadRoute, RemoveRoute } from "./routes";

export const list: AppRouteHandler<ListRoute> = async (c) => {
  // Reached only by admins — `requireRole("admin")` runs first.
  return c.json(await listPublicUsers(), HttpStatusCodes.OK);
};

export const read: AppRouteHandler<ReadRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const caller = c.get("user");

  if (caller.role !== "admin" && caller.id !== id) return forbiddenResponse(c);

  const user = await findPublicUserById(id);
  if (!user) return notFoundResponse(c);

  return c.json(user, HttpStatusCodes.OK);
};

export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const patchBody = c.req.valid("json");
  const caller = c.get("user");

  if (caller.role !== "admin" && caller.id !== id) return forbiddenResponse(c);

  // Without this, any user could PATCH themselves to admin.
  if (patchBody.role && caller.role !== "admin") return forbiddenResponse(c);

  const existing = await findPublicUserById(id);
  if (!existing) return notFoundResponse(c);

  // Changing the address invalidates the verification that covered the old one,
  // otherwise the "verified before login" rule would be trivially bypassed by
  // pointing the account at an address nobody has ever confirmed.
  const emailChanged =
    patchBody.email !== undefined && patchBody.email !== existing.email;

  const fields = {
    ...patchBody,
    ...(emailChanged ? { emailVerifiedAt: null } : {}),
  };

  // `patchUserSchema` is entirely optional, so `{}` is valid input. Drizzle
  // throws on an empty update, so treat it as the no-op it is.
  if (Object.keys(fields).length === 0) {
    return c.json(existing, HttpStatusCodes.OK);
  }

  const [updated] = await db
    .update(usersTable)
    .set(fields)
    .where(eq(usersTable.id, id))
    .returning(publicUserColumns);

  if (!updated) return notFoundResponse(c);

  if (emailChanged) {
    const token = await createAuthToken(
      id,
      "email_verification",
      env.EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
    );
    await sendEmail(verificationEmail(updated.email, token));
  }

  return c.json(updated, HttpStatusCodes.OK);
};

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const caller = c.get("user");

  if (caller.role !== "admin" && caller.id !== id) return forbiddenResponse(c);

  // Sessions, notes and outstanding tokens cascade with the row.
  const removed = await db
    .delete(usersTable)
    .where(eq(usersTable.id, id))
    .returning({ id: usersTable.id });

  if (!removed.length) return notFoundResponse(c);

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};
