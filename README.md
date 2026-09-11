# 🧋 hono-starter

A lightweight and modern starter template built with [Hono](https://hono.dev/), [Drizzle ORM](https://orm.drizzle.team/), and [Zod](https://zod.dev/) — perfect for building fast TypeScript web APIs.

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/srihari-m-s/hono-starter <project-name>
cd <project-name>
```

### 2. Create your environment file

Copy the `.env.example` file and create a `.env` file:

```bash
cp .env.example .env
```

Then, fill in the values in `.env`. At minimum, make sure `DATABASE_URL` is configured correctly for your PostgreSQL database.

### 3. Install dependencies

```bash
bun install
```

## 🗄️ Database Setup

### Using Docker (Optional)

A `docker-compose.yml` file is included to run PostgreSQL locally if you don't want to set it up manually.

**Requirements:**

- Docker must be installed and running on your system

**Start PostgreSQL with Docker Compose:**

```bash
docker-compose up -d
```

This sets up a local PostgreSQL instance accessible at:

```
postgres://postgres:postgres@localhost:5432/hono_starter
```

Update your `.env` file to match this URL if using Docker.

### Using Homebrew (macOS)

Alternatively, install PostgreSQL directly:

```bash
brew install postgresql@17
brew services start postgresql@17
```

Then create the database and role to match `.env`:

```bash
psql -d postgres -c "CREATE ROLE postgres LOGIN SUPERUSER PASSWORD 'postgres'"
createdb -O postgres hono_starter
createdb -O postgres hono_starter_test  # for the test suite
```

### Apply migrations

```bash
bun run db:migrate
```

## 🛠️ Scripts

All commands use bun.

**Run the development server:**

```bash
bun run dev
```

Runs the app using `bun --watch`.

**Install dependencies:**

```bash
bun install
```

**Generate database migrations:**

```bash
bun run db:generate
```

Generates SQL migrations using Drizzle based on your schema.

**Run database migrations:**

```bash
bun run db:migrate
```

Applies the generated migrations to the database defined in `.env`.

**Seed the database:**

```bash
bun run db:seed
```

**Build the project:**

```bash
bun run build
```

Bundles the app for the Bun runtime into `dist/`.

**Typecheck:**

```bash
bun run typecheck
```

**Lint:**

```bash
bun run lint
```

## 🧪 Testing

Tests use [bun:test](https://bun.sh/docs/test/writer) and run against a local PostgreSQL database (`hono_starter_test`, see setup above).

```bash
bun test
```

The suite is organized alongside the code it verifies:

- **Unit tests** – colocated with their modules (`src/lib/*.test.ts`, `src/env.test.ts`, `src/db/schema/*.test.ts`)
- **Feature/API tests** – colocated with their route modules (`src/routes/*/*.test.ts`) and passing through the full Hono app (real middleware, validation, and database)
- **Schema/migration tests** – `src/db/migrations.test.ts` verifies tables, constraints, and timestamp behavior
- **Server smoke test** – `src/index.test.ts` boots the Bun server on an ephemeral port

Shared test infrastructure lives in `tests/` (`tests/setup.ts` preload + `tests/helpers.ts`). The preload switches the app onto `hono_starter_test` and applies migrations to it automatically.

## 📁 Project Structure

```
.
├── src/
│   ├── db/              # Database config, schema, and seeds
│   ├── lib/             # Utility functions and shared code
│   ├── locale/          # Internationalization resources
│   ├── migrations/      # Database migration files
│   ├── middlewares/     # Hono middlewares (auth, language, error handling)
│   ├── routes/          # Hono routes (feature folders with co-located tests)
│   └── index.ts         # App entrypoint
├── tests/               # Shared test infrastructure (preload + helpers)
├── drizzle.config.ts    # Drizzle ORM config
├── .env.example         # Example env file
├── docker-compose.yml   # Docker setup for PostgreSQL
└── ...
```

## 📄 License

MIT — use it freely and make something awesome.