import { describe, expect, test } from "bun:test";
import { db } from "@/db";
import { notesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  cookieHeader,
  jsonHeaders,
  loggedInUser,
  testApp,
} from "../../../tests/helpers";

const app = testApp();

describe("note authentication", () => {
  test("listing requires a session", async () => {
    const res = await app.request("/note");
    expect(res.status).toBe(401);
  });

  test("creating requires a session", async () => {
    const res = await app.request("/note", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ content: "hello" }),
    });

    expect(res.status).toBe(401);
  });
});

describe("notes", () => {
  test("creates a note owned by the caller", async () => {
    const { cookie, row } = await loggedInUser();

    const res = await app.request("/note", {
      method: "POST",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ content: "hello world" }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: number;
      content: string;
      userId: number;
    };
    expect(body.content).toBe("hello world");
    expect(body.userId).toBe(row.id);
  });

  test("creates a note without content", async () => {
    const { cookie } = await loggedInUser();

    const res = await app.request("/note", {
      method: "POST",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);
    expect(((await res.json()) as { content: string | null }).content).toBeNull();
  });

  test("rejects a non-string content with 422", async () => {
    const { cookie } = await loggedInUser();

    const res = await app.request("/note", {
      method: "POST",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ content: 123 }),
    });

    expect(res.status).toBe(422);
    expect(((await res.json()) as { success: boolean }).success).toBe(false);
  });

  test("ignores a userId supplied by the client", async () => {
    const { cookie, row } = await loggedInUser();
    const victim = await loggedInUser();

    const res = await app.request("/note", {
      method: "POST",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ content: "spoofed", userId: victim.row.id }),
    });

    expect(res.status).toBe(201);
    expect(((await res.json()) as { userId: number }).userId).toBe(row.id);
  });

  test("lists only the caller's notes", async () => {
    const { cookie, row } = await loggedInUser();
    const other = await loggedInUser();

    await db.insert(notesTable).values([
      { userId: row.id, content: "mine" },
      { userId: other.row.id, content: "theirs" },
    ]);

    const res = await app.request("/note", { headers: cookieHeader(cookie) });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ content: string; userId: number }>;
    expect(body.some((n) => n.content === "mine")).toBe(true);
    expect(body.some((n) => n.content === "theirs")).toBe(false);
    expect(body.every((n) => n.userId === row.id)).toBe(true);
  });

  test("reads own note by id", async () => {
    const { cookie, row } = await loggedInUser();
    const [note] = await db
      .insert(notesTable)
      .values({ userId: row.id, content: "readable" })
      .returning();

    const res = await app.request(`/note/${note.id}`, {
      headers: cookieHeader(cookie),
    });

    expect(res.status).toBe(200);
    expect(((await res.json()) as { content: string }).content).toBe("readable");
  });

  test("another user's note looks missing, not forbidden", async () => {    const { cookie } = await loggedInUser();
    const other = await loggedInUser();
    const [theirs] = await db
      .insert(notesTable)
      .values({ userId: other.row.id, content: "private" })
      .returning();

    const res = await app.request(`/note/${theirs.id}`, {
      headers: cookieHeader(cookie),
    });

    // 404 rather than 403: the caller learns nothing about whether it exists.
    expect(res.status).toBe(404);
  });

  test("updates own note", async () => {
    const { cookie, row } = await loggedInUser();
    const [note] = await db
      .insert(notesTable)
      .values({ userId: row.id, content: "before" })
      .returning();

    const res = await app.request(`/note/${note.id}`, {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ content: "after" }),
    });

    expect(res.status).toBe(200);
    expect(((await res.json()) as { content: string }).content).toBe("after");
  });

  test("cannot update another user's note", async () => {
    const { cookie } = await loggedInUser();
    const other = await loggedInUser();
    const [theirs] = await db
      .insert(notesTable)
      .values({ userId: other.row.id, content: "before" })
      .returning();

    const res = await app.request(`/note/${theirs.id}`, {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ content: "hijacked" }),
    });

    expect(res.status).toBe(404);

    const untouched = await db
      .select()
      .from(notesTable)
      .where(eq(notesTable.id, theirs.id));
    expect(untouched[0]?.content).toBe("before");
  });

  test("an empty patch is a no-op, not a 500", async () => {
    const { cookie, row } = await loggedInUser();
    const [note] = await db
      .insert(notesTable)
      .values({ userId: row.id, content: "unchanged" })
      .returning();

    const res = await app.request(`/note/${note.id}`, {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    expect(((await res.json()) as { content: string }).content).toBe("unchanged");
  });

  test("deletes own note", async () => {
    const { cookie, row } = await loggedInUser();
    const [note] = await db
      .insert(notesTable)
      .values({ userId: row.id, content: "bye" })
      .returning();

    const res = await app.request(`/note/${note.id}`, {
      method: "DELETE",
      headers: cookieHeader(cookie),
    });

    expect(res.status).toBe(204);
  });

  test("cannot delete another user's note", async () => {
    const { cookie } = await loggedInUser();
    const other = await loggedInUser();
    const [theirs] = await db
      .insert(notesTable)
      .values({ userId: other.row.id, content: "keep me" })
      .returning();

    const res = await app.request(`/note/${theirs.id}`, {
      method: "DELETE",
      headers: cookieHeader(cookie),
    });

    expect(res.status).toBe(404);

    const stillThere = await db
      .select()
      .from(notesTable)
      .where(eq(notesTable.id, theirs.id));
    expect(stillThere).toHaveLength(1);
  });
});
