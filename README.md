# Runway

[![npm version](https://img.shields.io/npm/v/@vlynk-studios/runway.svg?style=flat-square)](https://www.npmjs.com/package/@vlynk-studios/runway)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

Runway is a lightweight, reliable, and transactional SQL migration CLI for Node.js. Designed for speed and consistency, it ensures your database schema evolves safely alongside your code.

## Features

- **Transactional** — every migration runs inside its own transaction. If it fails, it rolls back cleanly.
- **Integrity Checks** — SHA-256 checksums detect if an applied migration file is modified after the fact.
- **Dry-run mode** — preview what would be applied without touching the database.
- **Minimal footprint** — only 3 production dependencies: `pg`, `commander`, and `dotenv`.
- **Flexible config** — `runway.config.js` with multi-environment support (`envFile` / `testEnvFile`).
- **Adapter architecture** — PostgreSQL today, more databases on the roadmap.

## Installation

Install as a development dependency:

```bash
npm install -D @vlynk-studios/runway
```

Or run directly with npx:

```bash
npx @vlynk-studios/runway init
```

## Quick Start

```bash
# 1. Initialize Runway in your project
runway init

# 2. Create your first migration
runway create create_users_table

# 3. Run pending migrations
runway migrate

# 4. Check the current state
runway status
```

## Database Connection

Runway reads your database credentials from environment variables. You can use a connection string or individual variables.

**Via `DATABASE_URL`:**

```env
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
```

**Via individual variables:**

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=myuser
DB_PASSWORD=mypassword
DB_NAME=mydb

# Optional
DB_SSL=false
```

## Configuration

Run `runway init` to generate a `runway.config.js` in your project root:

```javascript
export default {
  // Directory where migration files are stored
  migrationsDir: './migrations',

  // Environment file for local development
  envFile: '.env',

  // Environment file used when NODE_ENV=test
  testEnvFile: '.env.test',

  // Optional: database connection overrides
  // (environment variables take precedence)
  database: {
    // url: 'postgresql://...',
    // host: 'localhost',
    // port: 5432,
    // user: 'myuser',
    // password: 'mypassword',
    // database: 'mydb',
    // ssl: false,
  }
};
```

**Priority chain:** `ENV vars > runway.config.js > defaults`

## Commands

| Command | Description |
| :--- | :--- |
| `runway init` | Bootstrap Runway in the current directory. |
| `runway create <name>` | Generate a new numbered migration file (`NNN_name.sql`). |
| `runway migrate` | Run all pending migrations in order. |
| `runway migrate --dry-run` | Preview what would be applied without touching the DB. |
| `runway migrate --env <path>` | Use a custom environment file for this run. |
| `runway status` | Show all migrations with their state and timestamps. |
| `runway baseline [version]` | Mark existing migrations as applied without running SQL. |
| `runway rollback` | *(coming in v0.2.0)* |

## Migration Files

Migration files follow the naming convention `NNN_description.sql`, where `NNN` is a zero-padded number that determines execution order.

```
migrations/
├── 001_create_users_table.sql
├── 002_add_email_index.sql
└── 003_create_posts_table.sql
```

`runway create <name>` handles the numbering automatically.

## Baseline

If you already have an existing database with a schema defined in your migration files, use `baseline` to register them as applied without executing any SQL. This is a one-time operation for onboarding existing databases.

```bash
runway baseline          # baseline all migrations
runway baseline 005      # baseline only up to migration 005
```

## Requirements

- Node.js `>= 18.0.0`
- PostgreSQL (other databases coming in a future release)

## Contribution

Contributions are welcome and greatly appreciated.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request against `dev`

---

Built with love by [Vlynk Studios](https://github.com/Vlynk-Studios) & [Keiver-Dev](https://github.com/Keiver-Dev)