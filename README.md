# Runway

[![npm version](https://img.shields.io/npm/v/@vlynk-studios/runway.svg?style=flat-square)](https://www.npmjs.com/package/@vlynk-studios/runway)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Coverage Status](https://img.shields.io/badge/Coverage-93%25-success.svg?style=flat-square)](#testing)
[![Build Status](https://img.shields.io/github/actions/workflow/status/vlynk-studios/runway/ci.yml?style=flat-square)](https://github.com/vlynk-studios/runway/actions)

Runway is a lightweight, reliable, and transactional SQL migration CLI for Node.js. Designed for speed and consistency, it ensures your database schema evolves safely alongside your code.

## Features

- **Transactional** — every migration runs inside its own transaction. If it fails, it rolls back cleanly.
- **Full Rollback Support** — easily revert applied migrations with multi-step support.
- **Integrity Checks** — SHA-256 checksums detect if an applied migration file is modified after the fact.
- **Integrity Validation** — `runway validate` cross-checks every applied migration against its recorded checksum without running SQL.
- **Cross-platform Consistent** — automatic line ending normalization (CRLF/LF) for team workflows.
- **Dry-run mode** — preview what would be applied without touching the database.
- **Version range control** — `--from` and `--to` flags to run only a specific range of migrations.
- **Minimal footprint** - only 6 production dependencies: `pg`, `commander`, `dotenv`, `chalk`, `ora`, and `inquirer`.
- **Flexible config** - `runway.config.js` with multi-environment support and guided initialization.
- **Pure ASCII UI** - 100% terminal-friendly with standardized English ASCII icons (No emojis).

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

# 5. Rollback if needed
runway rollback --steps 1
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
| `runway init` | Interactive guided setup to bootstrap Runway in the current directory. |
| `runway create <name>` | Generate a new numbered migration file (`NNN_name.sql`). Spaces in `<name>` are converted to hyphens automatically. |
| `runway migrate` | Run all pending migrations in order. Alias: `runway up`. |
| `runway migrate --from <n>` | Run only migrations starting from version `n` (inclusive). |
| `runway migrate --to <n>` | Run only migrations up to version `n` (inclusive). |
| `runway migrate --dry-run` | Preview what would be applied without touching the DB. |
| `runway migrate --env <path>` | Use a custom environment file for this run. |
| `runway validate` | Verify the checksum of every applied migration without running SQL. |
| `runway status` | Show all migrations with their state and timestamps. |
| `runway baseline [version]` | Mark existing migrations as applied without running SQL. |
| `runway rollback` | Revert the last applied migration. |
| `runway rollback --steps <n>` | Revert multiple migrations in order. |
| `runway rollback --dry-run` | Preview what would be reverted without touching the DB. |

## Use Cases

### New project

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

### Existing database onboarding

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

## Migration Files

Migration files follow the naming convention `NNN_description.sql` (UP) and `NNN_description.down.sql` (DOWN). `NNN` is a zero-padded number that determines execution order.

```
migrations/
├── 001_create_users_table.sql
├── 001_create_users_table.down.sql
├── 002_add_email_index.sql
└── 002_add_email_index.down.sql
```

`runway create <name>` handles both file creation and numbering automatically.

The `runway status` command uses the following ASCII indicators for maximum compatibility:

- `[APPLIED]` Migration has been successfully executed in the database.
- `[REVERTED]` Migration was previously applied but has since been rolled back.
- `[PENDING]` Migration file exists locally but has not been applied yet.
- `[ORPHAN ]` Migration is recorded as applied in the database but the file is missing from disk.
- `[OK]` General success indicator for step-level operations.
- `[x]` Summary indicator for applied migrations.
- `[ ]` Summary indicator for pending migrations.

## Baseline

If you already have an existing database with a schema defined in your migration files, use `baseline` to register them as applied without executing any SQL. This is a one-time operation for onboarding existing databases.

```bash
runway baseline          # baseline all migrations
runway baseline 005      # baseline only up to migration 005
```

## Requirements

- Node.js `>= 18.0.0`
- PostgreSQL (other databases coming in a future release)

## Testing

Runway is heavily tested with both unit and integration suites.

### Unit Tests
Fast tests using mocks. No external dependencies required.
```bash
npm run test
```

### Integration Tests
End-to-end tests using [Testcontainers](https://testcontainers.com/). **Requires Docker** to be running on your machine.
```bash
npm run test:integration
```

### Coverage
Generate a full coverage report:
```bash
npm run test:coverage
```

## Contribution

Contributions are welcome and greatly appreciated.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request against `dev`

---

Built with love by [Vlynk Studios](https://github.com/Vlynk-Studios) & [Keiver-Dev](https://github.com/Keiver-Dev)