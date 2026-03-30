import ora from 'ora';
import chalk from 'chalk';
import { config, validateDatabaseConfig } from '../config.js';
import { logger } from '../logger.js';
import { PostgresAdapter } from '../core/adapter/postgres.js';
import { MigrationRunner } from '../core/runner.js';

/**
 * Reverts the last migration applied to the database.
 */
export async function rollback(options) {
  // 1. Validate database configuration
  validateDatabaseConfig();

  // 2. Initialize Adapter & Runner
  const spinner = ora('Establishing database connection...').start();
  const adapter = new PostgresAdapter(config);
  const runner = new MigrationRunner(adapter, config);

  try {
    await adapter.connect();
    spinner.text = 'Rolling back migrations...';

    const dryRun = options.dryRun ?? false;
    const steps = parseInt(options.steps || '1', 10);

    if (dryRun) {
      spinner.stop();
      logger.warn('Dry-run mode enabled - no changes will be applied to the database.');
    }

    const result = await runner.rollback({ dryRun, steps });
    spinner.stop();

    // 3. Print Summary
    if (result.rolledBack > 0) {
      console.log(`\n${chalk.yellow.bold(result.rolledBack)} migration(s) rolled back successfully`);
      logger.suggest('runway status');
    } else {
      logger.info('No migrations were rolled back.');
    }

    console.log('\n');
  } catch (error) {
    spinner.fail('Rollback cycle failed');
    logger.error(error.message);
    process.exit(1);
  } finally {
    // Ensure the connection is always closed
    await adapter.end();
  }
}
