import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Test environment is set here (bunfig.toml preload) so it is in place before
// any src module is imported. dotenv in src/env.ts never overrides variables
// that are already present in process.env.
process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.LOG_LEVEL = "silent";
process.env.AUTH_COOKIE = "starter_auth";
process.env.AUTH_SECRET = "test-secret-that-is-long-enough-for-hs256";
process.env.AUTH_TOKEN_EXPIRY = "1";
process.env.DB_HOST = "localhost";
process.env.DB_USER = "postgres";
process.env.DB_PASSWORD = "postgres";
process.env.DB_NAME = "hono_starter_test";
process.env.DB_PORT = "5432";
process.env.DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/hono_starter_test";
process.env.DB_MIGRATING = "false";
process.env.DB_SEEDING = "false";

// Apply pending migrations to the test database in-process, before any test
// file imports the app (which connects to the DB at import time).
const migrationConnection = postgres(process.env.DATABASE_URL, {
  max: 1,
  onnotice: () => {},
});
const migrationDb = drizzle(migrationConnection);
await migrate(migrationDb, {
  migrationsFolder: join(process.cwd(), "src", "db", "migrations"),
});
await migrationConnection.end();