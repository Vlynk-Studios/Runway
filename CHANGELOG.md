# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
