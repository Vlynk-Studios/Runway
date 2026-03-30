import dotenv from 'dotenv';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
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
  const spinner = ora('Establishing database connection...').start();
  const adapter = new PostgresAdapter(config);
  const runner = new MigrationRunner(adapter, config);

  try {
    await adapter.connect();
    spinner.text = 'Checking migration status...';

    const dryRun = options.dryRun ?? false;

    if (dryRun) {
      spinner.stop();
      logger.warn('Dry-run mode enabled - no changes will be applied to the database.');
    } else {
      spinner.text = 'Running migrations...';
    }

    const result = await runner.run({ dryRun });
    spinner.stop();

    // 4. Print Summary
    if (result.applied > 0) {
      console.log(`\n${chalk.green.bold(result.applied)} migration(s) executed successfully`);
      logger.suggest('runway status');
    } else if (!dryRun) {
      logger.info('Database is already up to date.');
    } else {
      logger.info(`${result.applied} migration(s) would be applied.`);
    }

    console.log('\n');

  } catch (error) {
    spinner.fail('Migration cycle failed');
    logger.error(error.message);
    process.exit(1);
  } finally {
    // Ensure the connection is always closed
    await adapter.end();
  }
}
