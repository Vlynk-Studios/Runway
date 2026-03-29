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

    const filesInDir = new Set(
      fs.readdirSync(migrationsDir)
        .filter(f => /^\d+_.+\.sql$/.test(f) && !f.endsWith('.down.sql'))
    );

    // Get all unique names from both disk and history
    const allNames = new Set([...filesInDir, ...historyMap.keys()]);
    const sortedNames = Array.from(allNames).sort();

    logger.info('Database Migration Status:');
    console.log('');

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
        console.log(`${colors.red}[!] ${name.padEnd(45)}${colors.reset} ${colors.bright}${colors.red}applied but missing on disk${colors.reset} (at ${dateStr})`);
        continue;
      }

      if (record && !record.rolled_back_at) {
        // APPLIED
        appliedCount++;
        const dateStr = new Date(record.applied_at).toISOString().replace('T', ' ').split('.')[0];
        console.log(`${colors.green}[x] ${name.padEnd(45)}${colors.reset} applied at ${dateStr}`);

      } else if (record && record.rolled_back_at) {
        // ROLLED BACK
        rolledBackCount++;
        const appliedAtStr = new Date(record.applied_at).toISOString().replace('T', ' ').split('.')[0];
        const rolledBackAtStr = new Date(record.rolled_back_at).toISOString().replace('T', ' ').split('.')[0];
        console.log(`${colors.yellow}[r] ${name.padEnd(45)}${colors.reset} rolled back (Applied: ${appliedAtStr} | Rolled Back: ${rolledBackAtStr})`);

      } else if (existsOnDisk) {
        // PENDING
        pendingCount++;
        console.log(`${colors.gray}[ ] ${name.padEnd(45)} pending${colors.reset}`);
      }
    }

    logger.printDivider();
    logger.info('Summary:');
    console.log(`${colors.green}  [x] Applied     : ${appliedCount}${colors.reset}${orphanCount > 0 ? ` ${colors.red}(${orphanCount} missing on disk)${colors.reset}` : ''}`);
    console.log(`${colors.yellow}  [r] Rolled back : ${rolledBackCount}${colors.reset}`);
    
    if (pendingCount > 0) {
      console.log(`${colors.gray}  [ ] Pending     : ${pendingCount}${colors.reset} ${colors.dim}(Run 'runway migrate' to sync)${colors.reset}`);
    } else {
      console.log(`${colors.gray}  [ ] Pending     : 0${colors.reset} ${colors.green}(Database is up to date)${colors.reset}`);
    }
    console.log('\n');

  } catch (error) {
    logger.error(`Status command failed: ${error.message}`);
    process.exit(1);
  } finally {
    await adapter.end();
  }
}
