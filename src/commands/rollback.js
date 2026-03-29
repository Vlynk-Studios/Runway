import dotenv from 'dotenv';
import path from 'path';
import { config, validateDatabaseConfig } from '../config.js';
import { logger } from '../logger.js';
import { PostgresAdapter } from '../core/adapter/postgres.js';
import { MigrationRunner } from '../core/runner.js';

/**
 * Reverts the last migration applied to the database.
 */
export async function rollback(options) {
  // 1. Support for custom --env file
  if (options.env) {
    const envPath = path.resolve(process.cwd(), options.env);
    dotenv.config({ path: envPath, override: true });
    logger.info(`Using environment file: ${options.env}`);
  }

  // 2. Validate database configuration
  validateDatabaseConfig();

  // 3. Initialize Adapter & Runner
  const adapter = new PostgresAdapter(config);
  const runner = new MigrationRunner(adapter, config);

  try {
    await adapter.connect();

    const dryRun = options.dryRun ?? false;

    if (dryRun) {
      logger.warn('Dry-run mode enabled — no changes will be applied to the database.');
    }

    logger.info('Initiating rollback of the last migration...');
    const result = await runner.rollback({ dryRun });

    // 4. Print Summary
    logger.printDivider();
    if (dryRun) {
      if (result.rolledBack > 0) {
        logger.warn(`Dry-run complete. 1 migration would be rolled back. No changes were made.`);
      } else {
        logger.info('Nothing would be rolled back.');
      }
    } else if (result.rolledBack > 0) {
      logger.success('Last migration rolled back successfully!');
    }

    console.log('\n');
  } catch (error) {
    logger.error(`Rollback command failed: ${error.message}`);
    process.exit(1);
  } finally {
    // Ensure the connection is always closed
    await adapter.end();
  }
}
