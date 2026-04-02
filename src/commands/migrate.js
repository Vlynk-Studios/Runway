import ora from 'ora';
import chalk from 'chalk';
import { config, validateDatabaseConfig } from '../config.js';
import { logger } from '../logger.js';
import { getAdapter } from '../core/adapter/index.js';
import { MigrationRunner } from '../core/runner.js';

/**
 * Migration command handler.
 * Coordinates DB connection and the runner.
 */
export async function migrate(options) {
  // 1. Validate database configuration
  validateDatabaseConfig();

  // 2. Initialize Adapter & Runner
  const spinner = ora('Establishing database connection...').start();
  const adapter = getAdapter(config);
  const runner = new MigrationRunner(adapter, config);

  try {
    await adapter.connect();
    spinner.text = 'Checking migration status...';

    const dryRun = options.dryRun ?? false;
    const from = options.from ?? null;
    const to = options.to ?? null;

    // Stop the spinner before the execution loop in all cases.
    // runner.run() emits console.log lines per migration; mixing them with
    // an active spinner causes flickering and garbled output.
    spinner.stop();

    if (dryRun) {
      logger.warn('Dry-run mode enabled - no changes will be applied to the database.');
    } else {
      let rangeMsg = 'Running migrations...';
      if (from && to) rangeMsg = `Running migrations from ${from} to ${to}...`;
      else if (from) rangeMsg = `Running migrations from ${from}...`;
      else if (to) rangeMsg = `Running migrations up to ${to}...`;

      logger.info(rangeMsg);
    }

    const result = await runner.run({ dryRun, from, to });
    
    // 3. Print Summary
    if (result.applied > 0) {
      console.log(chalk.bold('\nMigrations Execution Summary:\n'));

      // Table Header
      const colStatus = 'STATUS'.padEnd(12);
      const colMigration = 'MIGRATION'.padEnd(45);
      const colInfo = 'DURATION';
      console.log(chalk.gray(`${colStatus} | ${colMigration} | ${colInfo}`));
      console.log(chalk.gray(`${'-'.repeat(12)}-+-${'-'.repeat(45)}-+-${'-'.repeat(15)}`));

      for (const { name, duration } of result.details) {
        const sRaw = '[OK]';
        const sStyled = chalk.green(sRaw);
        const dStr = `${duration.toFixed(0)}ms`;
        console.log(`${sStyled.padEnd(12 + (sStyled.length - sRaw.length))} | ${name.padEnd(45)} | ${chalk.gray(dStr)}`);
      }

      logger.printDivider();
      console.log(chalk.bold('Summary:'));
      console.log(`${chalk.green('  [x]')} Applied     : ${result.applied}`);
      
      if (dryRun) {
        logger.warn('This was a DRY-RUN. No changes were actually saved.');
      } else {
        logger.suggest('runway status');
      }
    } else if (!dryRun) {
      logger.info('No pending migrations found.');
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
