import { describe, expect, test } from "bun:test";
import { db } from "@/db";
import { notesTable, sessionsTable, usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/password";

const DATABASE_URL = process.env.DATABASE_URL as string;

async function createTestUser() {
  const [user] = await db
    .insert(usersTable)
    .values({
      firstName: "Mig",
      lastName: "Test",
      email: `mig-${crypto.randomUUID()}@example.com`,
      mobile: `98${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
      password: await hashPassword("TestPassphrase123!"),
    })
    .returning();

  return user;
}

describe("test database schema", () => {
  test("the test database is used", () => {
    expect(DATABASE_URL).toContain("hono_starter_test");
  });

  test("all tables exist", async () => {
    const tables = await db.execute<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const names = tables.map((r) => r.table_name);

    expect(names).toContain("users");
    expect(names).toContain("notes");
    expect(names).toContain("sessions");
    expect(names).toContain("auth_tokens");
  });

  test("email and mobile are unique", async () => {
    const constraints = await db.execute<{ constraint_name: string }>(
      `SELECT tc.constraint_name
       FROM information_schema.table_constraints tc
       WHERE tc.table_schema = 'public'
         AND tc.table_name = 'users'
         AND tc.constraint_type = 'UNIQUE'`,
    );
    const names = constraints.map((r) => r.constraint_name);
    expect(names.some((n) => n.includes("email"))).toBe(true);
    expect(names.some((n) => n.includes("mobile"))).toBe(true);
  });

  test("timestamp (string mode) round-trips as ISO strings", async () => {
    const user = await createTestUser();

    expect(typeof user.createdAt).toBe("string");
    expect(new Date(user.createdAt).toString()).not.toBe("Invalid Date");
    // Optional, and null until the address is confirmed.
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.role).toBe("user");

    await db.delete(usersTable).where(eq(usersTable.id, user.id));
  });

  test("deleting a user cascades to their notes and sessions", async () => {
    const user = await createTestUser();

    await db.insert(notesTable).values({ userId: user.id, content: "mine" });
    await db.insert(sessionsTable).values({
      tokenHash: `hash-${crypto.randomUUID()}`,
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await db.delete(usersTable).where(eq(usersTable.id, user.id));

    const notes = await db
      .select()
      .from(notesTable)
      .where(eq(notesTable.userId, user.id));
    const sessions = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.userId, user.id));

    expect(notes).toHaveLength(0);
    expect(sessions).toHaveLength(0);
  });

  test("updatedAt is bumped on update", async () => {
    const user = await createTestUser();
    const [note] = await db
      .insert(notesTable)
      .values({ userId: user.id, content: "before" })
      .returning();

    const createdAt = note.createdAt;
    const [updated] = await db
      .update(notesTable)
      .set({ content: "after" })
      .where(eq(notesTable.id, note.id))
      .returning();

    expect(updated.content).toBe("after");
    expect(updated.updatedAt).not.toBe(createdAt);

    await db.delete(usersTable).where(eq(usersTable.id, user.id));
  });
});
