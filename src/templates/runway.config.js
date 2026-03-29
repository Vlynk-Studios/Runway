/**
 * Runway Configuration File
 * This file is used to customize the behavior of the Runway CLI.
 */
export default {
  /**
   * Directory where your migration files are stored.
   * Default: './migrations'
   */
  migrationsDir: './migrations',

  /**
   * The .env file to load for default configuration.
   * Default: '.env'
   */
  envFile: '.env',

  /**
   * The .env file to load when running tests.
   * Default: '.env.test'
   */
  testEnvFile: '.env.test',

  /**
   * Database connection settings.
   * These can also be provided via environment variables (recommended).
   */
  database: {
    // url: process.env.DATABASE_URL,
    // host: process.env.DB_HOST || 'localhost',
    // port: parseInt(process.env.DB_PORT || '5432', 10),
    // user: process.env.DB_USER,
    // password: process.env.DB_PASSWORD,
    // database: process.env.DB_NAME,
    // ssl: process.env.DB_SSL === 'true'
  }
};
