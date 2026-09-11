import { describe, expect, test } from "bun:test";
import {
  cookieHeader,
  createUserWithPassword,
  jsonHeaders,
  loggedInUser,
  testApp,
} from "../../../tests/helpers";

const app = testApp();
const PASSWORD = "KnownPass123!";

describe("user CRUD (protected)", () => {
  test("lists users", async () => {
    const { cookie } = await loggedInUser();
    const res = await app.request("/users", { headers: cookieHeader(cookie) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("reads a user by id without exposing the password", async () => {
    const { cookie, row } = await loggedInUser();
    const res = await app.request(`/users/${row.id}`, {
      headers: cookieHeader(cookie),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(row.id);
    expect(body).not.toHaveProperty("password");
  });

  test("returns 404 for a missing user", async () => {
    const { cookie } = await loggedInUser();
    const res = await app.request("/users/99999999", {
      headers: cookieHeader(cookie),
    });
    expect(res.status).toBe(404);
  });

  test("returns 422 for a non-numeric id", async () => {
    const { cookie } = await loggedInUser();
    const res = await app.request("/users/abc", {
      headers: cookieHeader(cookie),
    });
    expect(res.status).toBe(422);
  });

  test("patches a user", async () => {
    const { cookie, row } = await loggedInUser();
    const res = await app.request(`/users/${row.id}`, {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ firstName: "Ada" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { firstName: string };
    expect(body.firstName).toBe("Ada");
    expect(body).not.toHaveProperty("password");
  });

  test("returns 404 when patching a missing user", async () => {
    const { cookie } = await loggedInUser();
    const res = await app.request("/users/99999999", {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ firstName: "Ada" }),
    });
    expect(res.status).toBe(404);
  });

  test("returns 422 when patching a non-numeric id", async () => {
    const { cookie } = await loggedInUser();
    const res = await app.request("/users/abc", {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ firstName: "Ada" }),
    });
    expect(res.status).toBe(422);
  });

  test("removes a user", async () => {
    const { cookie, row } = await loggedInUser();
    const remove = await app.request(`/users/${row.id}`, {
      method: "DELETE",
      headers: cookieHeader(cookie),
    });
    expect(remove.status).toBe(204);
    const read = await app.request(`/users/${row.id}`, {
      headers: cookieHeader(cookie),
    });
    expect(read.status).toBe(404);
  });

  test("returns 404 when removing a missing user", async () => {
    const { cookie } = await loggedInUser();
    const res = await app.request("/users/99999999", {
      method: "DELETE",
      headers: cookieHeader(cookie),
    });
    expect(res.status).toBe(404);
  });

  test("does not expose users to unauthenticated requests", async () => {
    const { row } = await createUserWithPassword(PASSWORD);
    const res = await app.request(`/users/${row.id}`);
    expect(res.status).toBe(401);
  });
});