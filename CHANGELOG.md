# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-04-07

### Added
- **Multi-dialect Support** — Runway now officially supports **MySQL** and **MariaDB** in addition to PostgreSQL.
- **`MySQLAdapter`** — Dedicated database adapter using the `mysql2/promise` driver, supporting structured config and `mysql://` URLs.
- **Adapter Factory (`getAdapter`)** — Centralized logic to instantiate the correct adapter based on the `dialect` configuration.
- **Dialect Configuration** — New `dialect` field in `runway.config.js` and `RUNWAY_DIALECT` environment variable (defaults to `postgres`).
- **Placeholder Translation** — Automatic translation of PostgreSQL-style placeholders (`$1`, `$2`) to MySQL format (`?`) in migration scripts and internal queries.

### Changed
- **MySQL-aware `LogTable`** — Refactored internal migration tracking to handle MySQL's lack of schemas, backtick identifiers, and `ON DUPLICATE KEY UPDATE` syntax.
- **Dialect-specific Default Ports** — `config.js` now intelligently sets the default port to `3306` for MySQL/MariaDB and `5432` for PostgreSQL.
- **Enhanced `runway init`** — Updated templates for `runway.config.js` and `.env.example` to include the `dialect` field.
- **Hardened Test Suite** — Added comprehensive unit tests for `MySQLAdapter`, `LogTable` (MySQL mode), and configuration validation, bringing the total to 108 tests.

### Notes
- **Backward Compatibility** — The default dialect remains `postgres`. Existing users do not need to change their configuration.

## [0.3.5] - 2026-03-31

### Added
- **Auto-detection in `runway init`** — The initialization process now 
  automatically scans for an existing `DATABASE_URL` or `DB_*` credentials 
  in `.env`. If detected, skips all database prompts and informs the user.
- **Credential-based init flow** — When no `.env` is found, `runway init` 
  now collects individual credentials (host, port, user, password, name) and 
  constructs a properly encoded `DATABASE_URL`, solving authentication failures 
  caused by special characters in passwords.
- **Detailed Execution Summary** — `runway up` now displays a full table with 
  STATUS / MIGRATION / DURATION for every applied migration.
- **Graceful Shutdown** — Added `SIGINT` and `SIGTERM` handlers to ensure all 
  active PostgreSQL connections are closed cleanly on process termination or 
  Ctrl+C.

### Fixed
- **Spinner/Logger Conflict** — Fixed flickering and garbled output in 
  `runway up` caused by `ora` spinner running concurrently with per-migration 
  `console.log` calls. Spinner now stops before the execution loop begins.
- **Orphan Count Correction** — Fixed a bug in `runway status` where orphaned 
  migrations were being double-counted as both "Applied" and "Orphaned". 
  Orphans are now correctly isolated into a distinct warning category.
- **Double Header in `init`** — Resolved an issue where the ASCII banner was 
  printed twice during `runway init`.
- **Creation Visibility** — `runway create` now logs both generated files 
  (`.sql` and `.down.sql`) on success.
- **CLI Parameter Consistency** — `status`, `baseline`, and `rollback` 
  handlers now correctly receive and forward the `options` parameter, ensuring 
  `--env` works consistently across all commands.

### Changed
- **Cleaner CLI Output** — Suppressed verbose `[dotenv@x.x.x] injecting env` 
  messages via quiet mode.
- **Code Hygiene** — Removed redundant `parseInt` in `rollback.js` and 
  eliminated the unused `_name` parameter from `printHeader`.
- **Test Suite Hardening** — Updated and expanded to 77/77 tests covering new 
  auto-detection logic, credential encoding, and graceful shutdown behavior.
  
## [0.3.0] - 2026-03-30

### Added
- **Interactive `runway init`** — a guided onboarding process that detects database presence, validates PostgreSQL URLs, and manages `.env` configuration (appending vs. creating) safely.
- **`runway validate`** — new command to verify SHA-256 checksums of all applied migrations against their files on disk, without executing any SQL. Reports the expected vs. actual checksum on mismatch with a clear, actionable message.
- **`runway migrate --from <n>` / `--to <n>`** — version range filters to restrict a migration run to a specific window of files.
- **Semantic connection error messages** — connection failures from PostgreSQL are now classified by root cause (host unreachable, auth failure, database not found, SSL error) and presented with specific remediation guidance. No raw stack traces are exposed.
- **SQL line-number reporting** — when a migration SQL statement fails, Runway reports the exact line number inside the file (derived from pg's character position offset) alongside the error message.
- **`DATABASE_URL` format validation** — if `DATABASE_URL` does not start with `postgresql://` or `postgres://`, Runway exits early with a clear format hint instead of forwarding a cryptic pg error.
- **Pure ASCII UI Standard** — migration of all CLI indicators and icons to 100% English ASCII (e.g. `[OK]`, `[x]`, `*`) for maximum terminal compatibility, removing all Unicode emojis.

### Changed
- `runway create <name>` now converts spaces in the name to hyphens automatically and logs the full relative path of the created file on success.
- README updated: interactive `init` flow, `runway validate`, `--from`/`--to` flags, and new ASCII status indicators.
- **Enhanced test suite** — achieved 96% coverage for the initialization flow and hardened E2E status workflows.

## [0.2.1] - 2026-03-29

### Fixed
- **Missing File** — restored the `.env.example` file in the project root which was accidentally removed during cleanup.

## [0.2.0] - 2026-03-29

### Added
- **Full Rollback Support** — implementation of `runway rollback` command to revert the last applied migration or multiple migrations using `--steps <n>`.
- **Dual-file Migration Convention** — `runway create` now generates both `.sql` (UP) and `.down.sql` (DOWN) files to ensure reversible migrations.
- **Advanced Status CLI** — redesigned `runway status` with ASCII indicators for better visibility:
    - `[x]` for applied migrations.
    - `[r]` for rolled back migrations.
    - `[ ]` for pending migrations.
    - `[!]` for applied migrations missing from disk (orphan detection).
- **Audit-ready History** — migrated from destructive deletion to a soft-mark system using the `rolled_back_at` column in `runway_migrations`.
- **Traceability** — the `status` command now displays both applied and rolled-back timestamps for full history visibility.

### Fixed
- **Multi-platform Checksum Consistency** — implemented line ending normalization (CRLF to LF) in `calculateChecksum` to ensure identical hashes across Windows, Linux, and macOS.
- **Migration Re-application Bug** — implemented UPSERT (ON CONFLICT) logic in `LogTable.registerMigration` to allow re-applying migrations that were previously rolled back.
- **SQL Injection Risk** — secured identifier escaping for schema and table names in `LogTable` to prevent potential injection via configuration.

### Changed
- `LogTable.getAppliedMigrations` now returns the complete history of both applied and reverted migrations.
- `MigrationRunner` now intelligently filters active migrations from the history to maintain consistency during `migrate` and `rollback` operations.
- Updated all CLI icons from Unicode emojis to standard ASCII characters for improved terminal compatibility.

## [0.1.0] - 2026-03-29

### Added
- `runway init` — bootstraps a new project with `./migrations/`, `runway.config.js`, and `.env.example`. Skips with a warning if files already exist.
- `runway create <name>` — generates a sequentially numbered `NNN_<name>.sql` migration file with an auto-incremented prefix (zero-padded to 3 digits).
- `runway migrate` — runs all pending migrations in order, each wrapped in a transaction. Supports `--env <path>` for custom environment files and `--dry-run` to preview changes without touching the database.
- `runway status` — lists all migration files with their state (applied with timestamp / pending) and a summary count.
- `runway baseline [version]` — marks existing migrations as applied without executing SQL, with a clear warning and transactional safety. Supports optional version prefix to baseline up to a specific point.
- `runway rollback` — registered as a CLI command (stub, coming in v0.2.0).
- **Checksum integrity checks** — SHA-256 checksums stored per migration; Runway detects if an applied file is modified and aborts with a clear error.
- **Vlynk-style logger** — ANSI-colored output with timestamps and levels (info / warn / error / success).
- **Dynamic configuration system** — priority chain: `ENV vars > runway.config.js > defaults`. Supports `DATABASE_URL` or individual `DB_HOST / DB_USER / DB_NAME` credentials.
- **Database Adapter Layer** — abstract `BaseAdapter` interface with a full `PostgresAdapter` implementation using the `pg` driver.
- **Unit test suite** — Jest tests covering `checksum`, `LogTable`, and `MigrationRunner` (including dry-run and integrity violation scenarios).
- **CI/CD workflows** — GitHub Actions for CI (Node 18/20/22 matrix) and automated npm publish on version tags.

## [0.1.0-alpha.1] - 2026-03-28

### Added
- Initial project structure and CLI backbone using Commander.js.
- Basic script definitions, repository setup, and development toolchain (ESLint, Prettier, Jest).
