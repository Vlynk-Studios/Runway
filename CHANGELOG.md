# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
