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

    let appliedCount = 0;
    let rolledBackCount = 0;
    let pendingCount = 0;
    let orphanCount = 0;

    for (const name of sortedNames) {
      const record = historyMap.get(name);
      const existsOnDisk = filesInDir.has(name);

      if (!existsOnDisk && record && !record.rolled_back_at) {
        // ORPHAN: Applied in DB but file is gone
        orphanCount++;
        appliedCount++;
        const dateStr = new Date(record.applied_at).toISOString().replace('T', ' ').split('.')[0];
        console.log(`${chalk.red('[!]')} ${name.padEnd(45)} ${chalk.bold.red('applied but missing on disk')} ${chalk.gray(`(at ${dateStr})`)}`);
        continue;
      }

      if (record && !record.rolled_back_at) {
        // APPLIED
        appliedCount++;
        const dateStr = new Date(record.applied_at).toISOString().replace('T', ' ').split('.')[0];
        console.log(`${chalk.green('[x]')} ${name.padEnd(45)} ${chalk.gray(`applied at ${dateStr}`)}`);

      } else if (record && record.rolled_back_at) {
        // ROLLED BACK
        rolledBackCount++;
        const appliedAtStr = new Date(record.applied_at).toISOString().replace('T', ' ').split('.')[0];
        const rolledBackAtStr = new Date(record.rolled_back_at).toISOString().replace('T', ' ').split('.')[0];
        console.log(`${chalk.yellow('[r]')} ${name.padEnd(45)} ${chalk.yellow('rolled back')} ${chalk.gray(`(Applied: ${appliedAtStr} | Rolled Back: ${rolledBackAtStr})`)}`);

      } else if (existsOnDisk) {
        // PENDING
        pendingCount++;
        console.log(`${chalk.dim('[ ]')} ${name.padEnd(45)} ${chalk.dim('pending')}`);
      }
    }

    logger.printDivider();
    console.log(chalk.bold('Summary:'));
    console.log(`${chalk.green('  [x]')} Applied     : ${appliedCount}${orphanCount > 0 ? ` ${chalk.red(`(${orphanCount} missing on disk)`)}` : ''}`);
    console.log(`${chalk.yellow('  [r]')} Rolled back : ${rolledBackCount}`);
    
    if (pendingCount > 0) {
      console.log(`${chalk.white('  [ ]')} Pending     : ${pendingCount} ${chalk.dim("(Run 'runway migrate' to sync)")}`);
      logger.suggest('runway migrate');
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
