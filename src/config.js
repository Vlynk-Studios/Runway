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
let userConfig = await loadConfigFile();

// 3. Helper to apply configuration values to the config object
function applyConfig(resolvedUserConfig) {
  const initialEnvPath = resolveEnvPath();
  
  // Re-apply env if config specify a different path
  if (!initialEnvPath && resolvedUserConfig.envFile && resolvedUserConfig.envFile !== '.env') {
    dotenv.config({ path: resolvedUserConfig.envFile, override: true, quiet: true, silent: true });
  }

  const resolvedDialect = process.env.RUNWAY_DIALECT || resolvedUserConfig.dialect || 'postgres';
  const defaultPort = resolvedDialect === 'mysql' ? '3306' : '5432';

  config.dialect = resolvedDialect;
  config.migrationsDir = process.env.RUNWAY_MIGRATIONS_DIR || resolvedUserConfig.migrationsDir || './migrations';
  config.schema = process.env.RUNWAY_SCHEMA || resolvedUserConfig.schema || 'public';
  
  config.database = {
    url: process.env.DATABASE_URL || resolvedUserConfig.database?.url,
    host: process.env.DB_HOST || resolvedUserConfig.database?.host,
    port: parseInt(process.env.DB_PORT || resolvedUserConfig.database?.port || defaultPort, 10),
    user: process.env.DB_USER || resolvedUserConfig.database?.user,
    password: process.env.DB_PASSWORD || resolvedUserConfig.database?.password,
    database: process.env.DB_NAME || resolvedUserConfig.database?.database,
    ssl: process.env.DB_SSL === 'true' || resolvedUserConfig.database?.ssl || false,
  };
}

/**
 * Refreshes the configuration by re-loading environment variables and the config file.
 * Essential for integration tests that change the working directory.
 */
export async function refreshConfig() {
  const initialEnvPath = resolveEnvPath();
  dotenv.config({ path: initialEnvPath || '.env', override: true, quiet: true, silent: true });
  
  userConfig = await loadConfigFile();
  applyConfig(userConfig);
}

// 4. Resolved configuration object for Runway.
export const config = {};

// Initial Load
applyConfig(userConfig);

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

  // Validate DATABASE_URL format early to avoid cryptic pg/mysql errors at connect time
  if (hasUrl) {
    const validSchemes = ['mysql', 'mariadb'].includes(config.dialect)
      ? /^(mysql|mariadb):\/\//i 
      : /^(postgres|postgresql):\/\//i;
      
    if (!validSchemes.test(database.url)) {
      logger.error('Invalid DATABASE_URL format.');
      const expected = ['mysql', 'mariadb'].includes(config.dialect)
        ? `${config.dialect}://user:password@host:port/dbname` 
        : 'postgresql://user:password@host:port/dbname';
      logger.info(
        `Expected format: ${expected}\n` +
        `Received:        ${database.url.slice(0, 60)}${database.url.length > 60 ? '...' : ''}`,
      );
      process.exit(1);
    }
  }
}
