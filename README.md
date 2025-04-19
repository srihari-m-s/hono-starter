# 🧋 hono-starter

A lightweight and modern starter template built with [Hono](https://hono.dev/) and [Drizzle ORM](https://orm.drizzle.team/) — perfect for building fast TypeScript web APIs.

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
pnpm install
```

## 🐳 Using Docker (Optional)

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

## 🛠️ Scripts

All commands use pnpm.

**Run the development server:**

```bash
pnpm dev
```

Runs the app using tsx with file watching.

**Generate database migrations:**

```bash
pnpm db:generate
```

Generates SQL migrations using Drizzle based on your schema.

**Run database migrations:**

```bash
pnpm db:migrate
```

Applies the generated migrations to the database defined in `.env`.

**Build the project:**

```bash
pnpm build
```

Builds the project using the TypeScript compiler.

## 📁 Project Structure

```
.
├── src/
│   ├── db/              # Database config, schema, and seeds
│   ├── lib/             # Utility functions and shared code
│   ├── locale/          # Internationalization resources
│   ├── migrations/      # Database migration files
│   ├── routes/          # Hono routes
│   └── index.ts         # App entrypoint
├── drizzle.config.ts    # Drizzle ORM config
├── .env.example         # Example env file
├── docker-compose.yml   # Docker setup for PostgreSQL
└── ...
```

## 📄 License

MIT — use it freely and make something awesome.
