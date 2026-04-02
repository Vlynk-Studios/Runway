import ora from 'ora';
import chalk from 'chalk';
import { config, validateDatabaseConfig } from '../config.js';
import { logger } from '../logger.js';
import { getAdapter } from '../core/adapter/index.js';
import { MigrationRunner } from '../core/runner.js';

/**
 * Reverts the last migration applied to the database.
 */
export async function rollback(options) {
  // 1. Validate database configuration
  validateDatabaseConfig();

  // 2. Initialize Adapter & Runner
  const spinner = ora('Establishing database connection...').start();
  const adapter = getAdapter(config);
  const runner = new MigrationRunner(adapter, config);

  try {
    await adapter.connect();
    spinner.text = 'Rolling back migrations...';

    const dryRun = options.dryRun ?? false;
    // Commander already coerces --steps via parseInt (see bin/runway.js).
    // Guard against NaN explicitly in case of invalid input.
    const steps = Number.isFinite(options.steps) ? options.steps : 1;

    if (dryRun) {
      spinner.stop();
      logger.warn('Dry-run mode enabled - no changes will be applied to the database.');
    }

    const result = await runner.rollback({ dryRun, steps });
    spinner.stop();

    // 3. Print Summary
    if (result.details && result.details.length > 0) {
      console.log(chalk.bold('\nRollback Execution Summary:\n'));

      // Table Header
      const colStatus = 'STATUS'.padEnd(12);
      const colMigration = 'MIGRATION'.padEnd(45);
      const colInfo = 'RESULT';
      console.log(chalk.gray(`${colStatus} | ${colMigration} | ${colInfo}`));
      console.log(chalk.gray(`${'-'.repeat(12)}-+-${'-'.repeat(45)}-+-${'-'.repeat(15)}`));

      for (const { name, status } of result.details) {
        const sRaw = `[${status}]`;
        const sStyled = status === 'REVERTED' ? chalk.yellow(sRaw) : chalk.cyan.dim(sRaw);
        const resMsg = status === 'REVERTED' ? 'Successfully reverted' : 'Would be reverted';
        console.log(`${sStyled.padEnd(12 + (sStyled.length - sRaw.length))} | ${name.padEnd(45)} | ${chalk.gray(resMsg)}`);
      }

      logger.printDivider();
      console.log(chalk.bold('Summary:'));
      console.log(`${chalk.yellow('  [r]')} Rolled back : ${result.rolledBack}`);
      
      if (dryRun) {
        logger.warn('This was a DRY-RUN. No changes were actually saved.');
      } else {
        logger.suggest('runway status');
      }
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
