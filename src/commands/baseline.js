import fs from 'fs';
import path from 'path';
import { config, validateDatabaseConfig } from '../config.js';
import { logger } from '../logger.js';
import { PostgresAdapter } from '../core/adapter/postgres.js';
import { LogTable } from '../core/log-table.js';
import { calculateChecksum } from '../core/checksum.js';

/**
 * Marks migrations as applied without executing their SQL content.
 * @param {string} version - Optional. Only baseline up to this version prefix.
 */
export async function baseline(version) {
  validateDatabaseConfig();
  
  const adapter = new PostgresAdapter(config);
  const logTable = new LogTable(config.schema);

  logger.printDivider();
  logger.warn('  ⚠️  BASELINE MODE ACTIVATED  ⚠️');
  logger.warn('This will record migrations as applied WITHOUT executing any SQL.');
  logger.warn('Use this ONLY once to synchronize an existing database with Runway');
  logger.warn('that already contains the schema defined in these files.');
  logger.printDivider();
  console.log('');

  try {
    await adapter.connect();
    await logTable.ensureTable(adapter);

    const applied = await logTable.getAppliedMigrations(adapter);
    const appliedSet = new Set(applied.map(m => m.name));

    const migrationsDir = path.resolve(process.cwd(), config.migrationsDir);
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found: ${config.migrationsDir}`);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => /^\d+_.+\.sql$/.test(f))
      .sort();

    // Determine target files based on version (if provided)
    const targetFiles = version 
      ? files.filter(f => parseInt(f.split('_')[0], 10) <= parseInt(version, 10))
      : files;

    const pending = targetFiles.filter(f => !appliedSet.has(f));

    if (pending.length === 0) {
      logger.info('No new migrations to baseline.');
      return;
    }

    logger.info(`Registering ${pending.length} migration(s) as baselined...`);

    // Use a transaction for the entire baseline process
    await adapter.begin();
    
    for (const file of pending) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const checksum = calculateChecksum(content);
      
      await logTable.registerMigration(adapter, file, checksum);
      logger.success(`[↷] ${file} — marked as applied`);
    }
    
    await adapter.commit();

    const alreadyApplied = files.length - pending.length;

    logger.printDivider();
    logger.success('Baseline process finished! ✓');
    logger.info(`  ↷ Marked as applied : ${pending.length}`);
    logger.info(`  ↷ Already registered : ${alreadyApplied}`);
    logger.info('Run "runway status" to verify the current state.');
    console.log('\n');

  } catch (error) {
    if (adapter) await adapter.rollback();
    logger.error(`Baseline command failed: ${error.message}`);
    process.exit(1);
  } finally {
    await adapter.end();
  }
}
