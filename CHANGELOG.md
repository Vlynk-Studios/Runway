# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New **Vlynk-style logger** with ANSI colors, timestamps, and formatted headers.
- **Dynamic Configuration System** with support for `runway.config.js` and `.env`.
- **Database Adapter Layer** with a standardized interface (`BaseAdapter`).
- **PostgreSQL Adapter** implemented using the `pg` library, supporting both connection strings and structured credentials.
- **Project Documentation**: Comprehensive README.md and .env.example with clear usage instructions.
- Initial templates for project bootstrapping.

### Fixed
- Fixed CLI visual output in `bin/runway.js` to match the new logger interface.

## [0.1.0-alpha.1] - 2026-03-28

### Added
- Initial project structure and CLI backbone using Commander.js.
- Basic script definitions, repository setup, and development toolchain (ESLint, Prettier, Jest).
