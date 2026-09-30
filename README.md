# 🧋 hono-starter

A lightweight and modern starter template built with [Hono](https://hono.dev/), [Drizzle ORM](https://orm.drizzle.team/), and [Zod](https://zod.dev/) — perfect for building fast TypeScript web APIs.

Batteries included: a complete auth system (server-side sessions, email verification, password reset, roles), type-safe OpenAPI routes, and integration tests that run against a real database.

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

Then, fill in the values in `.env`. At minimum, make sure `DATABASE_URL` is configured correctly for your PostgreSQL database. The defaults work out of the box for local development — emails are printed to stdout, so you do not need an email provider to get started.

### 3. Install dependencies

```bash
bun install
```

## 🗄️ Database Setup

### Using Docker (Optional)

A `docker-compose.yml` file is included to run PostgreSQL (and a local SMTP catcher) if you don't want to set them up manually.

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

### Seed some data

```bash
bun run db:seed
```

Creates one admin (`admin@example.com`) and one regular user (`user@example.com`), both verified, plus some notes. Password: `AdminPassphrase123!`.

## 🔐 Authentication

### The model

**Sessions are server-side rows, not JWTs.** At login the API generates a 256-bit random token, stores only its SHA-256 digest in the `sessions` table, and puts the raw token in an httpOnly cookie. Every request resolves the cookie back to a database row.

That choice is what makes the rest of the feature set possible:

| Capability | How |
| --- | --- |
| Logout | `DELETE` the row |
| Revoke a stolen session | `DELETE` the row |
| "Log out everywhere" | `DELETE WHERE user_id = …` |
| List active devices | `SELECT` from the table |
| Change what a session carries | Just read the row |

A stateless JWT can do none of these without an extra revocation list. The cost is one indexed lookup per request.

**Passwords** are hashed with argon2id via Bun's native `Bun.password` — no pure-JS hashing in the hot path. Inputs are Unicode-normalised (NFC) before hashing, so the same password entered on different keyboards verifies consistently.

### Password policy

The policy follows NIST SP 800-63B-4 (final, August 2025) and the OWASP Authentication Cheat Sheet, which both moved away from the rules most apps still use:

- **Minimum 15 characters**, counted in Unicode code points. Fifteen is NIST's floor for passwords used as a *single* factor; 8 would only be acceptable alongside a mandatory second factor, which this starter does not have.
- **Maximum 128 characters**, well above NIST's recommendation to permit at least 64 so passphrases work.
- **No composition rules.** NIST is explicit: *"Verifiers and CSPs SHALL NOT impose other composition rules (e.g., requiring mixtures of different character types)."* So `onlylowercaselettershere` and `correct horse battery staple` are both accepted, while `Password1!` is not — because it is on the blocklist, not because it lacks a symbol.
- **Blocklist screening** on signup, password reset and password change. The bundled list covers the most commonly used passwords, plus words derived from the account's own email and name (NIST's "context-specific words"). Trivial edits are still caught: `password123`, `Password1`, `p@ssw0rd` and `letmein123` all reduce to a listed entry. Comparison is whole-string, so a good passphrase that merely *contains* a common word is not rejected.
- **No forced rotation.** NIST: *"Verifiers and CSPs SHALL NOT require subscribers to change passwords periodically."*

Rejections return `422` with the reason, as NIST requires, and a rejected password on the reset flow does **not** consume the reset token, so the user can simply try again.

Set `PASSWORD_BREACH_LOOKUP=hibp` to additionally screen new passwords against Have I Been Pwned's [Pwned Passwords](https://haveibeenpwned.com/API/v3#PwnedPasswords) range API. It needs no key and uses k-anonymity — only the first five characters of the SHA-1 hash leave the process. It is off by default so a signup never depends on a third party; if the lookup fails it is skipped with a warning rather than blocking the request.

**Email verification is required before login.** A fresh account has `email_verified_at = NULL` and cannot start a session until it redeems the emailed token.

**Every email token is single-use and purpose-scoped.** Verification and password-reset tokens live in `auth_tokens` with a `purpose` column, an expiry, and a `consumed_at` marker. Redemption is a single atomic `UPDATE ... WHERE consumed_at IS NULL`, so two concurrent requests can never both succeed. Because the purpose is part of the lookup, a leaked session token cannot be replayed as a password reset — the two are not interchangeable.

### Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/sign_up` | public | Create an account (unverified) |
| `POST` | `/auth/verify_email` | public | Redeem the verification token |
| `GET` | `/auth/verify_email?token=…` | public | Same, but renders HTML for the emailed link |
| `POST` | `/auth/resend_verification` | public | Re-issue a verification link |
| `POST` | `/auth/login` | public | Start a session |
| `POST` | `/auth/logout` | session | Revoke the current session |
| `GET` | `/auth/session` | session | The current user |
| `GET` | `/auth/sessions` | session | List active sessions |
| `DELETE` | `/auth/sessions` | session | Revoke every session |
| `DELETE` | `/auth/sessions/{id}` | session | Revoke one session |
| `POST` | `/auth/change_password` | session | Change password (requires the current one) |
| `POST` | `/auth/forgot_password` | public | Email a reset link |
| `POST` | `/auth/reset_password` | public | Redeem a reset token and set a new password |

Interactive docs are served at `/reference` (Scalar) from the OpenAPI document at `/doc`.

Sessions are accepted from the cookie **or** from `Authorization: Bearer <token>`, so mobile and server-to-server clients don't need cookie handling.

### Walkthrough

```bash
# 1. Sign up. The password is yours; the email is not verified yet.
curl -X POST localhost:8080/auth/sign_up \
  -H 'content-type: application/json' \
  -d '{"firstName":"Ada","lastName":"Lovelace","email":"ada@example.com","mobile":"9876543210","password":"Sup3rSecret"}'

# 2. The verification email is printed to the server's stdout. Grab the token.
TOKEN=...

curl -X POST localhost:8080/auth/verify_email \
  -H 'content-type: application/json' -d "{\"token\":\"$TOKEN\"}"

# 3. Log in and keep the cookie.
curl -c cookies.txt -X POST localhost:8080/auth/login \
  -H 'content-type: application/json' \
  -d '{"identifier":"ada@example.com","password":"Sup3rSecret"}'

# 4. Use it.
curl -b cookies.txt localhost:8080/auth/session
curl -b cookies.txt -X POST localhost:8080/note \
  -H 'content-type: application/json' -d '{"content":"hello"}'

# 5. Log out.
curl -b cookies.txt -X POST localhost:8080/auth/logout
```

### Email

Emails go through a small `Mailer` interface (`src/lib/mailer/`) so you are not tied to a provider:

- **`console`** (default) — prints the email to stdout. No account, no network, works offline.
- **`memory`** — captures messages in-process. Used by the test suite.
- **`smtp`** — delivers over SMTP via nodemailer. Works with anything that speaks SMTP: Gmail app passwords, Resend, Brevo, Mailgun, SES, Postal, Mailjet.

Set `MAIL_TRANSPORT=smtp` plus `SMTP_HOST` and friends to switch. `SMTP_HOST` is required when the transport is `smtp`, and the app refuses to boot without it.

To try the SMTP path with no provider account, start the bundled Mailpit catcher:

```bash
docker-compose up -d mailpit
```

```env
MAIL_TRANSPORT=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
```

Sent mail appears at <http://localhost:8025>.

Verification and reset links are built from `APP_URL`. By default it points at this API, so the emailed link works end to end with no frontend: verification is a plain link, and the reset link opens a small form that posts to `/auth/reset_password`. Point `APP_URL` at your own app to handle tokens there instead (POST them to `/auth/verify_email` and `/auth/reset_password`).

### Abuse protection

- **Rate limiting** — a sliding-window limiter guards login, signup, password reset and the email-sending endpoints. Email endpoints get a tighter budget since every accepted request costs money or sender reputation.
- **Spoof-resistant keys** — the client address comes from the socket, not from a header. `X-Forwarded-For` is client-controlled, so it is only consulted when `TRUST_PROXY_HOPS` says a proxy you control appended to it, and the entry is then read from the right-hand end (`$proxy_add_x_forwarded_for` appends rather than replaces, so the left end is attacker-supplied). Leave `TRUST_PROXY_HOPS=0` when running the app directly.
- **Bounded store** — counters are capped at 10k keys with least-recently-used eviction, so a caller minting unique keys can't grow the process's memory. The store is still in-process, so behind multiple instances each replica enforces its own budget — swap in Redis when you scale out.
- **No account enumeration** — `forgot_password` and `resend_verification` return an identical `200` whether or not the address exists. Login performs a decoy hash comparison when the user is missing so response time doesn't leak registration either.
- **Origin check and CORS** — `ALLOWED_ORIGINS` is the allowlist for both. Browser origins not on the list get no CORS headers, and state-changing requests carrying an unexpected `Origin` are rejected. The session cookie is `httpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in production.

### Authorization

Authentication answers *who are you*; authorization answers *what may you do*. Both are in place:

- **Roles** — `users.role` is `user` or `admin`. Listing all users, and reading/updating/deleting someone else, requires `admin` (or being that user). Only admins may set a role, so a user cannot promote themselves.
- **Ownership** — notes belong to a user (`notes.user_id`) and every note query is scoped by the caller. Another user's note returns `404`, not `403`, so the API does not confirm that it exists.

`createPrivateRoute()` attaches the auth middleware and documents the `401`; `requireRole()` layers the role check on top.

### Production checklist

- [ ] Set `APP_URL` to your public origin and list any additional frontend origins in `ALLOWED_ORIGINS` (this drives both CORS and the `Origin` check).
- [ ] Set `TRUST_PROXY_HOPS` to the number of proxies you actually run, or leave it at `0` when the app is exposed directly.
- [ ] Serve over HTTPS so the session cookie is sent with `Secure`.
- [ ] Point `MAIL_TRANSPORT` at a real SMTP provider.
- [ ] Consider `PASSWORD_BREACH_LOOKUP=hibp` for full breach-corpus screening of new passwords.
- [ ] Replace the in-memory rate limiter with a shared store if you run more than one instance.
- [ ] Consider a scheduled call to `pruneExpiredSessions()` to keep the sessions table tidy.

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

Tests use [bun:test](https://bun.sh/docs/test/writer) and run against a local PostgreSQL database (`hono_starter_test`, see setup above). No network access or external service is required — emails are captured in-process.

```bash
bun test
```

The suite is organized alongside the code it verifies:

- **Unit tests** – colocated with their modules (`src/lib/*.test.ts`, `src/middlewares/*.test.ts`, `src/env.test.ts`, `src/db/schema/*.test.ts`)
- **Feature/API tests** – colocated with their route modules (`src/routes/*/*.test.ts`) and passing through the full Hono app (real middleware, validation, and database)
- **Schema/migration tests** – `src/db/migrations.test.ts` verifies tables, constraints, cascades, and timestamp behavior
- **Server smoke test** – `src/index.test.ts` boots the Bun server on an ephemeral port

Shared test infrastructure lives in `tests/` (`tests/setup.ts` preload + `tests/helpers.ts`). The preload switches the app onto `hono_starter_test` and applies migrations to it automatically.

Because the auth flows are end-to-end, the helpers drive them the same way a client would — `signUpVerified()` reads the verification token out of the captured email rather than inserting a pre-verified row.

## 📁 Project Structure

```
.
├── src/
│   ├── db/
│   │   ├── migrations/  # Drizzle SQL migrations
│   │   ├── schema/      # Tables + the Zod schemas derived from them
│   │   ├── index.ts     # Database connection
│   │   └── seed.ts      # Seed script
│   ├── lib/             # Utilities (auth tokens, sessions, passwords, mailer, …)
│   ├── locale/          # Internationalization resources
│   ├── middlewares/     # auth, require-role, rate-limit, origin-check, cors, error, logging
│   ├── routes/          # Hono routes (feature folders with co-located tests)
│   │   ├── auth/        # signup, login, sessions, verification, password reset
│   │   ├── user/        # user CRUD with role/ownership checks
│   │   └── note/        # per-user notes
│   └── index.ts         # App entrypoint
├── tests/               # Shared test infrastructure (preload + helpers)
├── drizzle.config.ts    # Drizzle ORM config
├── .env.example         # Example env file
├── docker-compose.yml   # PostgreSQL + Mailpit for local development
└── ...
```

## 📄 License

MIT — use it freely and make something awesome.
