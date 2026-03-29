/**
 * Runway Configuration File
 * This file is used to customize the behavior of the Runway CLI.
 */
export default {
  /**
   * migrationsDir: The directory where your migration files are stored.
   * By default, Runway looks in './migrations'.
   */
  migrationsDir: './migrations',

  /**
   * envFile: Path to the .env file that should be loaded during initialization.
   * Usually '.env' for local development.
   */
  envFile: '.env',

  /**
   * testEnvFile: Path to the .env file that should be loaded during test execution.
   * Useful for pointing to a dedicated test database (e.g., '.env.test').
   */
  testEnvFile: '.env.test',

  /**
   * database: Deep configuration for the database connection.
   * Note: It is recommended to use environment variables for sensitive data.
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
