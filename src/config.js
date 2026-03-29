import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { logger } from './logger.js';

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

// Load user config from file
const userConfig = await loadConfigFile();

// Determine variables path from user config or default to .env
const isTest = process.env.NODE_ENV === 'test';
const envFilePath = isTest && userConfig.testEnvFile ? userConfig.testEnvFile : (userConfig.envFile || '.env');

// Initialize environment variables ASAP
dotenv.config({ path: envFilePath });

/**
 * Resolved configuration object for Runway.
 * Priorities: Environment Variables > runway.config.js > Defaults.
 */
export const config = {
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
    logger.info('Please specify a connection via DATABASE_URL or by providing DB_HOST, DB_USER, and DB_NAME.');
    process.exit(1);
  }
}
