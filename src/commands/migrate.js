import dotenv from 'dotenv';
import path from 'path';
import { config, validateDatabaseConfig } from '../config.js';
import { logger } from '../logger.js';
import { PostgresAdapter } from '../core/adapter/postgres.js';
import { MigrationRunner } from '../core/runner.js';

/**
 * Migration command handler.
 * Coordinates environment loading, DB connection, and the runner.
 */
export async function migrate(options) {
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

    logger.info('Starting migration synchronization...');
    const result = await runner.run({ dryRun });

    // 4. Print Summary
    logger.printDivider();
    if (dryRun) {
      logger.warn(`Dry-run complete. ${result.applied} migration(s) would be applied. No changes were made.`);
    } else if (result.applied > 0) {
      logger.success('Database migration synchronized successfully! 🛫');
    } else {
      logger.info('Database is already up to date.');
    }

    // Display summary as a formatted table
    console.table({
      'Applied Migrations': result.applied,
      'Skipped (Already Applied)': result.skipped,
      'Failed': result.failed
    });
    console.log('\n');

  } catch (error) {
    logger.error(`Migration command failed: ${error.message}`);
    process.exit(1);
  } finally {
    // Ensure the connection is always closed
    await adapter.end();
  }
}
