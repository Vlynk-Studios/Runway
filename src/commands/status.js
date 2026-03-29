import fs from 'fs';
import path from 'path';
import { config, validateDatabaseConfig } from '../config.js';
import { logger } from '../logger.js';
import { PostgresAdapter } from '../core/adapter/postgres.js';
import { LogTable } from '../core/log-table.js';

/**
 * Lists all migrations and their current status in the database.
 */
export async function status() {
  validateDatabaseConfig();
  
  const adapter = new PostgresAdapter(config);
  const logTable = new LogTable(config.schema);

  try {
    await adapter.connect();
    await logTable.ensureTable(adapter);

    const applied = await logTable.getAppliedMigrations(adapter);
    const appliedMap = new Map(applied.map(m => [m.name, m.applied_at]));

    const migrationsDir = path.resolve(process.cwd(), config.migrationsDir);
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found: ${config.migrationsDir}`);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => /^\d+_.+\.sql$/.test(f))
      .sort();

    logger.info('Database Migration Status:');
    console.log('');

    for (const file of files) {
      const appliedAt = appliedMap.get(file);
      if (appliedAt) {
        // Format date: YYYY-MM-DD HH:mm:ss
        const dateStr = new Date(appliedAt).toISOString().replace('T', ' ').split('.')[0];
        logger.success(`[✓] ${file.padEnd(45)} applied at ${dateStr}`);
      } else {
        logger.warn(`[↷] ${file.padEnd(45)} pending`);
      }
    }

    const pendingCount = files.length - applied.length;
    
    logger.printDivider();
    logger.info('Summary:');
    logger.info(`  ✓ Applied : ${applied.length}`);
    if (pendingCount > 0) {
      logger.warn(`  ↷ Pending : ${pendingCount} (Run 'runway migrate' to sync)`);
    } else {
      logger.success('  ↷ Pending : 0 (Database is up to date)');
    }
    console.log('\n');

  } catch (error) {
    logger.error(`Status command failed: ${error.message}`);
    process.exit(1);
  } finally {
    await adapter.end();
  }
}
