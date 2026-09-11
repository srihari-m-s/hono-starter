import { describe, expect, test } from "bun:test";
import { db } from "@/db";
import { notesTable } from "@/db/schema";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL as string;

describe("test database schema", () => {
  test("the test database is used", () => {
    expect(DATABASE_URL).toContain("hono_starter_test");
  });

  test("users and notes tables exist", async () => {
    const tables = await db.execute<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const names = tables.map((r) => r.table_name);
    expect(names).toContain("users");
    expect(names).toContain("notes");
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
    const [user] = await db
      .insert(usersTable)
      .values({
        firstName: "Ts",
        lastName: "Test",
        email: `ts-${crypto.randomUUID()}@example.com`,
        mobile: `98${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
        password: "hashed",
      })
      .returning();

    expect(typeof user.createdAt).toBe("string");
    expect(new Date(user.createdAt).toString()).not.toBe("Invalid Date");
    expect(typeof user.emailVerifiedAt).toBe("string");

    await db.delete(usersTable).where(eq(usersTable.id, user.id));
  });

  test("updatedAt is bumped on update", async () => {
    const [note] = await db
      .insert(notesTable)
      .values({ content: "before" })
      .returning();

    const createdAt = note.createdAt;
    const [updated] = await db
      .update(notesTable)
      .set({ content: "after" })
      .where(eq(notesTable.id, note.id))
      .returning();

    expect(updated.content).toBe("after");
    expect(updated.updatedAt).not.toBe(createdAt);

    await db.delete(notesTable).where(eq(notesTable.id, note.id));
  });
});