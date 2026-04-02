import ora from 'ora';
import chalk from 'chalk';
import { config, validateDatabaseConfig } from '../config.js';
import { logger } from '../logger.js';
import { getAdapter } from '../core/adapter/index.js';
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
  const adapter = getAdapter(config);
  const runner = new MigrationRunner(adapter, config);

  try {
    await adapter.connect();
    
    // 3. Execution
    const details = await runner.validate();
    spinner.stop();

    if (details.length > 0) {
      console.log(chalk.bold('\nIntegrity Validation Summary:\n'));

      // Table Header
      const colStatus = 'STATUS'.padEnd(12);
      const colMigration = 'MIGRATION'.padEnd(45);
      const colInfo = 'CHECKSUM';
      console.log(chalk.gray(`${colStatus} | ${colMigration} | ${colInfo}`));
      console.log(chalk.gray(`${'-'.repeat(12)}-+-${'-'.repeat(45)}-+-${'-'.repeat(32)}`));

      for (const { name, checksum } of details) {
        const sRaw = '[PASSED]';
        const sStyled = chalk.green(sRaw);
        console.log(`${sStyled.padEnd(12 + (sStyled.length - sRaw.length))} | ${name.padEnd(45)} | ${chalk.gray(checksum)}`);
      }

      logger.printDivider();
      logger.success('Integrity validation passed: All applied migrations match their local files.');
    } else {
      logger.info('No migrations have been applied yet. Nothing to validate.');
    }

    console.log('\n');
  } finally {
    await adapter.end();
  }
}
