import ora from 'ora';
import { config, validateDatabaseConfig } from '../config.js';
import { logger } from '../logger.js';
import { PostgresAdapter } from '../core/adapter/postgres.js';
import { MigrationRunner } from '../core/runner.js';

/**
 * Validation command handler.
 * Verifies that all applied migrations match their checksums on disk.
 */
export async function validate() {
  // 1. Ensure configuration is valid
  validateDatabaseConfig();

  // 2. Initialize orchestration
  const spinner = ora('Validating database integrity...').start();
  const adapter = new PostgresAdapter(config);
  const runner = new MigrationRunner(adapter, config);

  try {
    await adapter.connect();
    
    // 3. Execution
    await runner.validate();
    
    spinner.succeed('Integrity validation passed');
    logger.success('All applied migrations match their local files.');

  } catch (error) {
    spinner.fail('Validation failed');
    logger.error(error.message);
    process.exit(1);
  } finally {
    await adapter.end();
  }
}
