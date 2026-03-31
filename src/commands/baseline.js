import fs from 'fs';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { config, validateDatabaseConfig } from '../config.js';
import { logger } from '../logger.js';
import { PostgresAdapter } from '../core/adapter/postgres.js';
import { LogTable } from '../core/log-table.js';
import { calculateChecksum } from '../core/checksum.js';
/**
 * Marks migrations as applied without executing their SQL content.
 * @param {string} version  - Optional. Only baseline up to this version prefix.
 * @param {object} _options - CLI options (--env is consumed by config.js at load time).
 */
export async function baseline(version, _options = {}) {
  validateDatabaseConfig();

  console.log('\n' + chalk.bold.yellow('! BASELINE MODE ACTIVATED !'));
  console.log(chalk.yellow('This will record migrations as applied WITHOUT executing any SQL.'));
  console.log(chalk.yellow('Use this ONLY to synchronize an existing database with Runway.\n'));

  const adapter = new PostgresAdapter(config);
  const logTable = new LogTable(config.schema);
  const spinner = ora('Initializing baseline...').start();

  try {
    await adapter.connect();
    await logTable.ensureTable(adapter);

    const applied = await logTable.getAppliedMigrations(adapter);
    const appliedSet = new Set(applied.map((m) => m.name));

    const migrationsDir = path.resolve(process.cwd(), config.migrationsDir);
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(
        `Migrations directory not found: ${config.migrationsDir}`,
      );
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => /^\d+_.+\.sql$/.test(f))
      .sort();

    // Determine target files based on version (if provided)
    const targetFiles = version
      ? files.filter(
          (f) => parseInt(f.split('_')[0], 10) <= parseInt(version, 10),
        )
      : files;

    const pending = targetFiles.filter((f) => !appliedSet.has(f));

    if (pending.length === 0) {
      spinner.stop();
      logger.info('No new migrations to baseline.');
      return;
    }

    spinner.text = `Registering ${pending.length} migration(s) as baselined...`;

    // Use a transaction for the entire baseline process
    await adapter.begin();

    for (const file of pending) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const checksum = calculateChecksum(content);

      await logTable.registerMigration(adapter, file, checksum);
    }

    await adapter.commit();
    spinner.stop();

    const alreadyApplied = files.length - pending.length;

    console.log(chalk.bold('\nBaseline process finished!'));
    console.log(
      `${chalk.green('[OK]')} Marked as applied  : ${chalk.bold(pending.length)}`,
    );
    console.log(`${chalk.gray('*')} Already registered : ${alreadyApplied}`);

    logger.suggest('runway status');
    console.log('\n');
  } catch (error) {
    spinner.fail('Baseline failed');
    if (adapter) await adapter.rollback();
    logger.error(error.message);
    process.exit(1);
  } finally {
    await adapter.end();
  }
}
