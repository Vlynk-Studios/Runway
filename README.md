# Runway

[![npm version](https://img.shields.io/npm/v/@vlynk-studios/runway.svg?style=flat-square)](https://www.npmjs.com/package/@vlynk-studios/runway)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Coverage Status](https://img.shields.io/badge/Coverage-93%25-success.svg?style=flat-square)](#testing)
[![Build Status](https://img.shields.io/github/actions/workflow/status/vlynk-studios/runway/ci.yml?style=flat-square)](https://github.com/vlynk-studios/runway/actions)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org)

Runway is a lightweight, reliable, and transactional SQL migration CLI for Node.js, supporting **PostgreSQL**, **MySQL**, and **MariaDB**. Designed for speed and consistency, it ensures your database schema evolves safely alongside your code.

---

## Table of Contents

- [Features](#features)
- [Database Support](#database-support)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Database Connection](#database-connection)
  - [PostgreSQL Setup](#postgresql-setup)
  - [MySQL & MariaDB Setup](#mysql--mariadb-setup)
- [Configuration](#configuration)
- [Commands](#commands)
  - [init](#runway-init)
  - [create](#runway-create-name)
  - [migrate](#runway-migrate--up)
  - [rollback](#runway-rollback)
  - [status](#runway-status)
  - [validate](#runway-validate)
  - [baseline](#runway-baseline-version)
- [Migration Files](#migration-files)
- [Use Cases](#use-cases)
  - [New Project](#new-project)
  - [Existing Database Onboarding](#existing-database-onboarding)
- [Status Indicators](#status-indicators)
- [Architecture Overview](#architecture-overview)
- [Testing](#testing)
- [Requirements](#requirements)
- [Contribution](#contribution)

---

## Features

- **Transactional** — every migration runs inside its own transaction. If it fails, it rolls back cleanly.
- **Full Rollback Support** — easily revert applied migrations with multi-step support.
- **Integrity Checks** — SHA-256 checksums detect if an applied migration file is modified after the fact.
- **Integrity Validation** — `runway validate` cross-checks every applied migration against its recorded checksum without running SQL.
- **Multi-dialect** — supports PostgreSQL, MySQL 8.0+, and MariaDB out of the box.
- **Cross-platform Consistent** — automatic line ending normalization (CRLF/LF) for team workflows.
- **Dry-run mode** — preview what would be applied without touching the database.
- **Version range control** — `--from` and `--to` flags to run only a specific range of migrations.
- **Minimal footprint** — only 7 production dependencies: `pg`, `mysql2`, `commander`, `dotenv`, `chalk`, `ora`, and `inquirer`.
- **Flexible config** — `runway.config.js` with multi-environment support and guided initialization.
- **Pure ASCII UI** — 100% terminal-friendly with standardized English ASCII icons (no emojis).

---

## Database Support

| Database       | Supported |  Driver   | Notes                                     |
| :------------- | :-------: | :-------: | :---------------------------------------- |
| **PostgreSQL** |    Yes    |   `pg`    | Recommended for full feature support.     |
| **MySQL**      |    Yes    | `mysql2`  | Supports version 8.0+ and MariaDB.        |
| **MariaDB**    |    Yes    | `mysql2`  | Fully compatible.                         |
| **SQLite**     |    No     |     -     | Coming in a future release.               |

---

## Installation

Install as a development dependency:

```bash
npm install -D @vlynk-studios/runway
```

Or run directly with npx:

```bash
npx @vlynk-studios/runway init
```

---

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

# 5. Rollback if needed
runway rollback --steps 1
```

---

## Database Connection

Runway reads your database credentials from environment variables. You can use a connection string or individual variables.

### PostgreSQL Setup

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

### MySQL & MariaDB Setup

**Via `DATABASE_URL`:**

```env
DATABASE_URL=mysql://user:password@localhost:3306/mydb
```

**Via individual variables:**

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=myuser
DB_PASSWORD=mypassword
DB_NAME=mydb
```

> [!NOTE]
> **MySQL Schemas**: Since MySQL uses database names as schemas, the `schema` configuration field is ignored for MySQL/MariaDB connections.

---

## Configuration

Run `runway init` to generate a `runway.config.js` in your project root:

```javascript
export default {
  // Database engine: 'postgres' (default), 'mysql', or 'mariadb'
  dialect: 'postgres',

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

### Environment Variables Reference

| Variable               | Description                                              | Default       |
| :--------------------- | :------------------------------------------------------- | :------------ |
| `DATABASE_URL`         | Full connection string (overrides individual DB_* vars)  | —             |
| `DB_HOST`              | Database host                                            | —             |
| `DB_PORT`              | Database port                                            | `5432` / `3306` |
| `DB_USER`              | Database user                                            | —             |
| `DB_PASSWORD`          | Database password                                        | —             |
| `DB_NAME`              | Database name                                            | —             |
| `DB_SSL`               | Enable SSL (`true` / `false`)                            | `false`       |
| `RUNWAY_DIALECT`       | Database dialect (`postgres`, `mysql`, `mariadb`)        | `postgres`    |
| `RUNWAY_MIGRATIONS_DIR`| Path to migrations directory                             | `./migrations`|
| `RUNWAY_SCHEMA`        | Database schema (PostgreSQL only)                        | `public`      |
| `RUNWAY_ENV`           | Custom environment file path                             | —             |

---

## Commands

### `runway init`

Interactive guided setup to bootstrap Runway in the current directory.

- Detects existing `DATABASE_URL` or `DB_*` credentials in `.env` and skips setup prompts accordingly.
- Collects individual credentials (host, port, user, password, name) and constructs a properly encoded `DATABASE_URL`.
- Creates `runway.config.js` and the `./migrations/` directory.

```bash
runway init
```

---

### `runway create <name>`

Generate a new numbered migration file pair (`NNN_name.sql` and `NNN_name.down.sql`). Spaces in `<name>` are converted to hyphens automatically.

```bash
runway create create_users_table
runway create "add email index"      # spaces are converted to hyphens
```

**Output:**

```
[Runway: success] Migration created:
[Runway: success]   + migrations/001_create_users_table.sql
[Runway: success]   + migrations/001_create_users_table.down.sql
```

---

### `runway migrate` / `up`

Run all pending migrations in order. Each migration runs inside its own transaction. Runway also checks the integrity (checksum) of all previously applied migrations before running new ones.

```bash
runway migrate
runway up                           # alias

# Options
runway migrate --dry-run            # preview without touching the DB
runway migrate --from 003           # run from migration 003 (inclusive)
runway migrate --to 007             # run up to migration 007 (inclusive)
runway migrate --from 003 --to 007  # run a specific range
runway migrate --env .env.staging   # use a custom environment file
```

**Output example:**

```
Migrations Execution Summary:

STATUS       | MIGRATION                                     | DURATION
-------------|-----------------------------------------------|---------------
[OK]         | 001_create_users_table.sql                    | 12ms
[OK]         | 002_add_email_index.sql                       | 8ms
--------------------------------------------------
Summary:
  [x] Applied     : 2
```

---

### `runway rollback`

Revert the last applied migration (or multiple). Runway executes the corresponding `.down.sql` file inside a transaction, then marks the migration as rolled back in the history table.

```bash
runway rollback                     # revert the last migration
runway rollback --steps 3           # revert the last 3 migrations
runway rollback --dry-run           # preview without touching the DB
```

> [!WARNING]
> Each migration must have a corresponding `.down.sql` file. Runway will halt if the rollback file is missing.

---

### `runway status`

Show all migrations with their current state and timestamps.

```bash
runway status
```

**Output example:**

```
Database Migration Status:

STATUS       | MIGRATION                                     | INFORMATION
-------------|-----------------------------------------------|------------------------------
[APPLIED]    | 001_create_users_table.sql                    | applied at 2026-04-07 10:22:01
[APPLIED]    | 002_add_email_index.sql                       | applied at 2026-04-07 10:22:01
[REVERTED]   | 003_add_roles_table.sql                       | rolled back (pending re-run)
[PENDING]    | 004_add_permissions_table.sql                 | ready to apply
--------------------------------------------------
Summary:
  [x] Applied     : 2
  [r] Rolled back : 1
  [ ] Pending     : 2  (Run 'runway up' to sync)
```

---

### `runway validate`

Verify the SHA-256 checksum of every applied migration against its file on disk — without executing any SQL. Detects accidental or unauthorized modifications to migration files.

```bash
runway validate
```

If a mismatch is detected, Runway exits with a clear error showing both the expected and actual checksums.

---

### `runway baseline [version]`

Mark existing migrations as applied without executing their SQL content. This is a one-time operation for onboarding existing databases that already have the schema applied.

```bash
runway baseline          # baseline all migrations
runway baseline 005      # baseline only up to migration 005
```

> [!CAUTION]
> This command is intended for onboarding existing databases only. Do not use it on migrations that have not yet been applied to your database.

---

## Migration Files

Migration files follow the naming convention `NNN_description.sql` (UP) and `NNN_description.down.sql` (DOWN). `NNN` is a zero-padded number that determines execution order.

```
migrations/
├── 001_create_users_table.sql
├── 001_create_users_table.down.sql
├── 002_add_email_index.sql
├── 002_add_email_index.down.sql
├── 003_add_roles_table.sql
└── 003_add_roles_table.down.sql
```

`runway create <name>` handles both file creation and numbering automatically.

**Example UP migration (`001_create_users_table.sql`):**

```sql
-- Migration: create_users_table (UP)
-- Created: 2026-04-07 10:00:00

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Example DOWN migration (`001_create_users_table.down.sql`):**

```sql
-- Migration: create_users_table (DOWN)
-- Created: 2026-04-07 10:00:00

DROP TABLE IF EXISTS users;
```

---

## Status Indicators

The `runway status` command uses the following ASCII indicators for maximum compatibility:

| Indicator   | Meaning                                                                     |
| :---------- | :-------------------------------------------------------------------------- |
| `[APPLIED]` | Migration has been successfully executed in the database.                   |
| `[REVERTED]`| Migration was previously applied but has since been rolled back.            |
| `[PENDING]` | Migration file exists locally but has not been applied yet.                 |
| `[ORPHAN ]` | Migration is recorded as applied in the database but the file is missing.   |
| `[OK]`      | General success indicator for step-level operations.                        |
| `[x]`       | Summary indicator for applied migrations.                                   |
| `[ ]`       | Summary indicator for pending migrations.                                   |

---

## Use Cases

### New Project

Starting a greenfield project with Runway:

```bash
# Bootstrap the project
runway init

# Create migrations as your schema evolves
runway create create_users_table
runway create add_email_index

# Apply to the database
runway migrate

# Verify everything is consistent
runway validate
```

### Existing Database Onboarding

You already have a production database and want to bring it under Runway's control:

```bash
# Your migrations directory already reflects the current schema.
# Register them as applied without re-running the SQL:
runway baseline

# From this point on, new migrations are managed normally
runway create add_roles_table
runway migrate

# Audit integrity at any time
runway validate
runway status
```

### CI/CD Integration

```bash
# In your deployment pipeline, just run:
runway migrate

# For safety, validate integrity before migrating:
runway validate && runway migrate
```

---

## Architecture Overview

Runway is built around a clean separation of concerns:

```
bin/runway.js             → CLI entry point (Commander.js)
src/
  commands/               → One file per command
    init.js
    create.js
    migrate.js
    rollback.js
    status.js
    baseline.js
    validate.js
  core/
    runner.js             → MigrationRunner — orchestrates migrate, rollback, and validate
    log-table.js          → LogTable — manages the runway_migrations tracking table
    checksum.js           → SHA-256 checksum calculation with CRLF normalization
    adapter/
      base.js             → BaseAdapter interface
      postgres.js         → PostgresAdapter (pg driver)
      mysql.js            → MySQLAdapter (mysql2 driver)
      index.js            → getAdapter() factory function
  config.js               → Configuration resolution (ENV > config file > defaults)
  logger.js               → Chalk-based logger with ASCII output
```

The adapter layer abstracts all database-specific behavior. Adding a new database dialect only requires implementing `BaseAdapter` and registering it in `getAdapter()`.

---

## Testing

Runway is heavily tested with both unit and integration suites, achieving **93% coverage**.

### Unit Tests

Fast tests using mocks. No external dependencies required.

```bash
npm test
```

### Integration Tests

End-to-end tests using [Testcontainers](https://testcontainers.com/). **Requires Docker** to be running on your machine. Covers both PostgreSQL and MySQL.

```bash
npm run test:integration
```

### Coverage Report

Generate a full coverage report:

```bash
npm run test:coverage
```

Coverage thresholds are enforced at **80%** for branches, functions, lines, and statements.

---

## Requirements

- **Node.js** `>= 18.0.0`
- **PostgreSQL**, **MySQL 8.0+**, or **MariaDB**

---

## Contribution

Contributions are welcome and greatly appreciated.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request against `dev`

---

Built with love by [Vlynk Studios](https://github.com/Vlynk-Studios) & [Keiver-Dev](https://github.com/Keiver-Dev)