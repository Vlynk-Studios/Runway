import fs from 'fs';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { config, validateDatabaseConfig } from '../config.js';
import { logger } from '../logger.js';
import { PostgresAdapter } from '../core/adapter/postgres.js';
import { LogTable } from '../core/log-table.js';

/**
 * Lists all migrations and their current status in the database.
 */
export async function status() {
  validateDatabaseConfig();
  
  const spinner = ora('Fetching database status...').start();
  const adapter = new PostgresAdapter(config);
  const logTable = new LogTable(config.schema);

  try {
    await adapter.connect();
    await logTable.ensureTable(adapter);

    const history = await logTable.getAppliedMigrations(adapter);
    spinner.stop();

    const historyMap = new Map(history.map(m => [m.name, m]));

    const migrationsDir = path.resolve(process.cwd(), config.migrationsDir);
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found: ${config.migrationsDir}`);
    }

    const filesInDir = new Set(
      fs.readdirSync(migrationsDir)
        .filter(f => /^\d+_.+\.sql$/.test(f) && !f.endsWith('.down.sql'))
    );

    // Get all unique names from both disk and history
    const allNames = new Set([...filesInDir, ...historyMap.keys()]);
    const sortedNames = Array.from(allNames).sort();

    console.log(chalk.bold('\nDatabase Migration Status:\n'));

    // Table Header
    const colStatus = 'STATUS'.padEnd(12);
    const colMigration = 'MIGRATION'.padEnd(45);
    const colInfo = 'INFORMATION';
    console.log(chalk.gray(`${colStatus} | ${colMigration} | ${colInfo}`));
    console.log(chalk.gray(`${'-'.repeat(12)}-+-${'-'.repeat(45)}-+-${'-'.repeat(30)}`));

    let appliedCount = 0;
    let rolledBackCount = 0;
    let pendingCount = 0;
    let orphanCount = 0;

    for (const name of sortedNames) {
      const record = historyMap.get(name);
      const existsOnDisk = filesInDir.has(name);

      let statusRaw = '';
      let statusStyled = '';
      let info = '';

      if (!existsOnDisk && record && !record.rolled_back_at) {
        // ORPHAN: Applied in DB but file is gone
        statusRaw = '[ORPHAN ]';
        statusStyled = chalk.bold.red(statusRaw);
        orphanCount++;
        appliedCount++;
        const dateStr = new Date(record.applied_at).toISOString().replace('T', ' ').split('.')[0];
        info = chalk.red(`Missing on disk (applied ${dateStr})`);

      } else if (record && !record.rolled_back_at) {
        // APPLIED
        statusRaw = '[APPLIED]';
        statusStyled = chalk.green(statusRaw);
        appliedCount++;
        const dateStr = new Date(record.applied_at).toISOString().replace('T', ' ').split('.')[0];
        info = chalk.gray(`applied at ${dateStr}`);

      } else if (record && record.rolled_back_at) {
        // ROLLED BACK (REVERTED)
        statusRaw = '[REVERTED]';
        statusStyled = chalk.yellow(statusRaw);
        rolledBackCount++;
        if (existsOnDisk) {
          pendingCount++;
          info = chalk.yellow('rolled back (pending re-run)');
        } else {
          info = chalk.gray('rolled back (missing on disk)');
        }

      } else if (existsOnDisk) {
        // PENDING
        statusRaw = '[PENDING]';
        statusStyled = chalk.cyan.dim(statusRaw);
        pendingCount++;
        info = chalk.dim('ready to apply');
      }

      console.log(`${statusStyled.padEnd(12 + (statusStyled.length - statusRaw.length))} | ${name.padEnd(45)} | ${info}`);
    }

    logger.printDivider();
    console.log(chalk.bold('Summary:'));
    console.log(`${chalk.green('  [x]')} Applied     : ${appliedCount}${orphanCount > 0 ? ` ${chalk.red(`(${orphanCount} missing on disk)`)}` : ''}`);
    console.log(`${chalk.yellow('  [r]')} Rolled back : ${rolledBackCount}`);
    
    if (pendingCount > 0) {
      console.log(`${chalk.cyan('  [ ]')} Pending     : ${pendingCount} ${chalk.dim("(Run 'runway up' to sync)")}`);
      logger.suggest('runway up');
    } else {
      console.log(`${chalk.gray('  [ ]')} Pending     : 0 ${chalk.green('(Database is up to date)')}`);
    }
    console.log('\n');

  } catch (error) {
    spinner.fail('Failed to fetch status');
    logger.error(error.message);
    process.exit(1);
  } finally {
    await adapter.end();
  }
}
