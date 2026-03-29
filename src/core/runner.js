import fs from 'fs';
import path from 'path';
import { LogTable } from './log-table.js';
import { calculateChecksum } from './checksum.js';
import { logger } from '../logger.js';

/**
 * Orchestrates the database migration process.
 */
export class MigrationRunner {
  constructor(adapter, config) {
    this.adapter = adapter;
    this.config = config;
    this.logTable = new LogTable(config.schema);
  }

  /**
   * Identifies and executes all pending migrations.
   * Performs an integrity check on previously applied migrations.
   * @param {object} options
   * @param {boolean} [options.dryRun=false] - If true, shows what would run without applying changes.
   */
  async run({ dryRun = false } = {}) {
    const summary = { applied: 0, skipped: 0, failed: 0 };
    const migrationsDir = path.resolve(process.cwd(), this.config.migrationsDir);

    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found: ${this.config.migrationsDir}`);
    }

    // Initialize the migrations log table
    await this.logTable.ensureTable(this.adapter);

    // Get applied migrations from the DB
    const applied = await this.logTable.getAppliedMigrations(this.adapter);
    const appliedMap = new Map(applied.map(m => [m.name, m.checksum]));

    // Get files from the migrations directory
    const files = fs.readdirSync(migrationsDir)
      .filter(f => /^\d+_.+\.sql$/.test(f) && !f.endsWith('.down.sql'))
      .sort();

    for (const file of files) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const checksum = calculateChecksum(content);

      if (appliedMap.has(file)) {
        // Integrity Check: Has the file changed since it was applied?
        if (appliedMap.get(file) !== checksum) {
          logger.error(`Checksum mismatch for applied migration: ${file}`);
          summary.failed++;
          throw new Error(`Integrity violation: The file "${file}" has been modified after being applied.`);
        }
        summary.skipped++;
        continue;
      }

      // Dry-run mode: show what would be executed, skip actual changes
      if (dryRun) {
        logger.warn(`[DRY-RUN] Would apply: ${file}`);
        summary.applied++;
        continue;
      }

      // Execute the migration
      logger.info(`Applying migration: ${file}`);
      
      try {
        await this.adapter.begin();
        await this.adapter.query(content);
        await this.logTable.registerMigration(this.adapter, file, checksum);
        await this.adapter.commit();
        
        logger.success(`Success: ${file}`);
        summary.applied++;
      } catch (error) {
        await this.adapter.rollback();
        
        // Detailed error context for PostgreSQL
        let context = '';
        if (error.position) context += ` (at character ${error.position})`;
        if (error.detail) context += ` - ${error.detail}`;
        
        logger.error(`Migration failed: ${file}${context}`);
        logger.error(error.message);
        summary.failed++;
        throw error;
      }
    }

    return summary;
  }

  /**
   * Reverts the last migration applied to the database.
   * @param {object} options
   * @param {boolean} [options.dryRun=false] - If true, shows what would happen without applying changes.
   */
  async rollback({ dryRun = false } = {}) {
    const migrationsDir = path.resolve(process.cwd(), this.config.migrationsDir);

    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found: ${this.config.migrationsDir}`);
    }

    // Initialize the migrations log table
    await this.logTable.ensureTable(this.adapter);

    const applied = await this.logTable.getAppliedMigrations(this.adapter);
    if (applied.length === 0) {
      logger.info('No migrations have been applied yet. Nothing to rollback.');
      return { rolledBack: 0 };
    }

    // Get the most recently applied migration
    const lastMigration = applied[applied.length - 1];
    const migrationName = lastMigration.name;

    // Check for corresponding .down.sql file
    const downFileName = migrationName.replace(/\.sql$/, '.down.sql');
    const downFilePath = path.join(migrationsDir, downFileName);

    if (!fs.existsSync(downFilePath)) {
      throw new Error(
        `Rollback failed: The rollback file "${downFileName}" was not found.\n` +
        `Ensure you created the migration with rollback support.`
      );
    }

    const content = fs.readFileSync(downFilePath, 'utf8');

    if (dryRun) {
      logger.warn(`[DRY-RUN] Would rollback: ${migrationName} using ${downFileName}`);
      return { rolledBack: 1 };
    }

    logger.info(`Rolling back migration: ${migrationName}`);

    try {
      await this.adapter.begin();
      await this.adapter.query(content);
      await this.logTable.deleteMigration(this.adapter, migrationName);
      await this.adapter.commit();

      logger.success(`Success: Rolled back ${migrationName}`);
      return { rolledBack: 1 };
    } catch (error) {
      await this.adapter.rollback();

      let context = '';
      if (error.position) context += ` (at character ${error.position})`;
      if (error.detail) context += ` - ${error.detail}`;

      logger.error(`Rollback failed for ${migrationName}${context}`);
      logger.error(error.message);
      throw error;
    }
  }
}
