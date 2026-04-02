import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { logger } from './logger.js';

/**
 * Resolves the environment file path based on CLI flags, environment variables, or config.
 */
function resolveEnvPath() {
  const args = process.argv;
  const envFlagIndex = args.findIndex(arg => arg === '--env' || arg === '-e');
  
  if (envFlagIndex !== -1 && args[envFlagIndex + 1]) {
    return args[envFlagIndex + 1];
  }
  
  if (process.env.RUNWAY_ENV) {
    return process.env.RUNWAY_ENV;
  }
  
  return null; // Will fallback to .env after loading config if needed
}

// 1. Initial Environment Load (Early detection from CLI/Env Var)
const initialEnvPath = resolveEnvPath();
dotenv.config({ path: initialEnvPath || '.env', quiet: true, silent: true });

/**
 * Attempts to load runway.config.js from the current working directory.
 */
async function loadConfigFile() {
  const configPath = path.resolve(process.cwd(), 'runway.config.js');
  
  if (fs.existsSync(configPath)) {
    try {
      const configUrl = pathToFileURL(configPath).href;
      const module = await import(configUrl);
      return module.default || module || {};
    } catch (error) {
      logger.warn(`Could not load runway.config.js: ${error.message}`);
      return {};
    }
  }
  
  return {};
}

// 2. Load user config from file
const userConfig = await loadConfigFile();

// 3. Re-initialize environment if config specify a different path and no override was provided
if (!initialEnvPath && userConfig.envFile && userConfig.envFile !== '.env') {
  dotenv.config({ path: userConfig.envFile, override: true, quiet: true, silent: true });
}

/**
 * Resolved configuration object for Runway.
 * Priorities: Environment Variables > runway.config.js > Defaults.
 */
export const config = {
  dialect: process.env.RUNWAY_DIALECT || userConfig.dialect || 'postgres',
  migrationsDir: process.env.RUNWAY_MIGRATIONS_DIR || userConfig.migrationsDir || './migrations',
  schema: process.env.RUNWAY_SCHEMA || userConfig.schema || 'public',
  
  database: {
    url: process.env.DATABASE_URL || userConfig.database?.url,
    host: process.env.DB_HOST || userConfig.database?.host,
    port: parseInt(process.env.DB_PORT || userConfig.database?.port || '5432', 10),
    user: process.env.DB_USER || userConfig.database?.user,
    password: process.env.DB_PASSWORD || userConfig.database?.password,
    database: process.env.DB_NAME || userConfig.database?.database,
    ssl: process.env.DB_SSL === 'true' || userConfig.database?.ssl || false,
  }
};

/**
 * Validates the database configuration.
 * Throws an error with clear messaging if mandatory fields are missing.
 */
export function validateDatabaseConfig() {
  const { database } = config;

  const hasUrl = !!database.url;
  const hasFullCredentials = !!(database.host && database.user && database.database);

  if (!hasUrl && !hasFullCredentials) {
    logger.error('Missing database configuration.');
    logger.info(
      'Provide a connection via DATABASE_URL or by setting DB_HOST, DB_USER, and DB_NAME.',
    );
    process.exit(1);
  }

  // Validate DATABASE_URL format early to avoid cryptic pg errors at connect time
  if (hasUrl) {
    const validSchemes = /^(postgres|postgresql):\/\//i;
    if (!validSchemes.test(database.url)) {
      logger.error('Invalid DATABASE_URL format.');
      logger.info(
        'Expected format: postgresql://user:password@host:port/dbname\n' +
        `Received:        ${database.url.slice(0, 60)}${database.url.length > 60 ? '...' : ''}`,
      );
      process.exit(1);
    }
  }
}
