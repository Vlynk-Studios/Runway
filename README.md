# Runway 🛫

[![npm version](https://img.shields.io/npm/v/@vlynk-studios/runway.svg?style=flat-square)](https://www.npmjs.com/package/@vlynk-studios/runway)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

Runway is a lightweight, reliable, and transactional database migration tool for Node.js and PostgreSQL. Designed for speed and consistency, it ensures your database schema evolves safely alongside your code.

## Installation 📦

Install as a development dependency:

```bash
npm install -D @vlynk-studios/runway
```

Or initialize your project directly:

```bash
npx @vlynk-studios/runway init
```

## Features ✨

- **Transactional**: Every migration is executed within a transaction to ensure atomicity.
- **Integrity Checks**: Automatic SHA-256 checksum validation to prevent accidental migration changes.
- **Postgres Native**: Built specifically for PostgreSQL using the robust `pg` driver.
- **Zero-Dependency Core**: Minimal external dependencies for a faster and more secure CLI.
- **Flexible Config**: Easy-to-use `runway.config.js` with support for multiple environments.

## Configuration ⚙️

Initialize your project with `runway init` to create a `runway.config.js` file:

```javascript
/**
 * Runway Configuration File
 */
export default {
  // Directory where migration files are stored
  migrationsDir: './migrations',

  // Environment files to load configuration from
  envFile: '.env',
  testEnvFile: '.env.test',

  // Optional: database configuration overrides
  database: {
    // schema: 'public'
  }
};
```

## Commands 🚀

| Command | Description |
| :--- | :--- |
| `init` | Bootstrap Runway in the current directory. |
| `create <name>` | Generate a new timestamped migration file. |
| `migrate` | Run all pending migrations in order. |
| `status` | Show applied and pending migrations. |
| `baseline <version>` | Mark the database as already updated to a version. |

## Contribution 🤝

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

Built with ❤️ by [Vlynk Studios](https://github.com/Vlynk-Studios) & [Keiver-Dev](https://github.com/Keiver-Dev)
