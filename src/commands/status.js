import fs from 'fs';
import path from 'path';
import { config, validateDatabaseConfig } from '../config.js';
import { logger, colors } from '../logger.js';
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

    const history = await logTable.getAppliedMigrations(adapter);
    const historyMap = new Map(history.map(m => [m.name, m]));

    const migrationsDir = path.resolve(process.cwd(), config.migrationsDir);
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found: ${config.migrationsDir}`);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => /^\d+_.+\.sql$/.test(f))
      .sort();

    logger.info('Database Migration Status:');
    console.log('');

    let appliedCount = 0;
    let rolledBackCount = 0;
    let pendingCount = 0;

    for (const file of files) {
      const record = historyMap.get(file);

      if (record && !record.rolled_back_at) {
        // APPLIED: Record exists and no rollback timestamp
        appliedCount++;
        const dateStr = new Date(record.applied_at).toISOString().replace('T', ' ').split('.')[0];
        console.log(`${colors.green}✓ ${file.padEnd(45)}${colors.reset} applied at ${dateStr}`);

      } else if (record && record.rolled_back_at) {
        // ROLLED BACK: Record exists but has rolled_back_at
        rolledBackCount++;
        const appliedAtStr = new Date(record.applied_at).toISOString().replace('T', ' ').split('.')[0];
        const rolledBackAtStr = new Date(record.rolled_back_at).toISOString().replace('T', ' ').split('.')[0];
        console.log(`${colors.yellow}↺ ${file.padEnd(45)}${colors.reset} rolled back (Applied: ${appliedAtStr} | Rolled Back: ${rolledBackAtStr})`);

      } else {
        // PENDING: No record in database
        pendingCount++;
        console.log(`${colors.gray}↷ ${file.padEnd(45)} pending${colors.reset}`);
      }
    }

    logger.printDivider();
    logger.info('Summary:');
    console.log(`${colors.green}  ✓ Applied     : ${appliedCount}${colors.reset}`);
    console.log(`${colors.yellow}  ↺ Rolled back : ${rolledBackCount}${colors.reset}`);
    
    if (pendingCount > 0) {
      console.log(`${colors.gray}  ↷ Pending     : ${pendingCount}${colors.reset} ${colors.dim}(Run 'runway migrate' to sync)${colors.reset}`);
    } else {
      console.log(`${colors.gray}  ↷ Pending     : 0${colors.reset} ${colors.green}(Database is up to date)${colors.reset}`);
    }
    console.log('\n');

  } catch (error) {
    logger.error(`Status command failed: ${error.message}`);
    process.exit(1);
  } finally {
    await adapter.end();
  }
}
