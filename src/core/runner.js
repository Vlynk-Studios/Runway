import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
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
    const summary = { applied: 0, skipped: 0, failed: 0, details: [] };
    const migrationsDir = path.resolve(process.cwd(), this.config.migrationsDir);

    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found: ${this.config.migrationsDir}`);
    }

    // Initialize the migrations log table
    await this.logTable.ensureTable(this.adapter);

    // Get migration history and filter active ones
    const history = await this.logTable.getAppliedMigrations(this.adapter);
    const activeApplied = history.filter(m => !m.rolled_back_at);
    const appliedMap = new Map(activeApplied.map(m => [m.name, m.checksum]));

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
      
      const startTime = performance.now();
      try {
        await this.adapter.begin();
        await this.adapter.query(content);
        await this.logTable.registerMigration(this.adapter, file, checksum);
        await this.adapter.commit();
        
        const duration = performance.now() - startTime;
        summary.applied++;
        summary.details.push({ name: file, duration });
        
        logger.stepSuccess(file, duration);
      } catch (error) {
        await this.adapter.rollback();
        
        // Enrich the error with migration context
        let context = '';
        if (error.position) context += ` (at character ${error.position})`;
        if (error.detail) context += ` - ${error.detail}`;
        
        error.message = `Migration "${file}" failed${context}: ${error.message}`;
        summary.failed++;
        throw error;
      }
    }

    return summary;
  }

  /**
   * Reverts the last N migration(s) applied to the database.
   * @param {object} options
   * @param {boolean} [options.dryRun=false] - If true, shows what would happen without applying changes.
   * @param {number} [options.steps=1] - Number of migrations to revert.
   */
  async rollback({ dryRun = false, steps = 1 } = {}) {
    const migrationsDir = path.resolve(process.cwd(), this.config.migrationsDir);
    const summary = { rolledBack: 0, failed: 0 };

    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found: ${this.config.migrationsDir}`);
    }

    // Initialize the migrations log table
    await this.logTable.ensureTable(this.adapter);

    // Get all applied migrations that aren't rolled back
    const history = await this.logTable.getAppliedMigrations(this.adapter);
    const applied = history.filter(m => !m.rolled_back_at);

    if (applied.length === 0) {
      logger.info('No migrations have been applied yet. Nothing to rollback.');
      return summary;
    }

    const totalSteps = Math.min(steps, applied.length);
    if (steps > applied.length) {
      logger.warn(`Requested ${steps} steps, but only ${applied.length} migration(s) are applied. Rolling back all.`);
    }

    for (let i = 0; i < totalSteps; i++) {
      // Re-fetch or pop from the list to get the current "last" migration
      const lastMigration = applied.pop();
      const migrationName = lastMigration.name;

      // Check for corresponding .down.sql file
      const downFileName = migrationName.replace(/\.sql$/, '.down.sql');
      const downFilePath = path.join(migrationsDir, downFileName);

      if (!fs.existsSync(downFilePath)) {
        throw new Error(
          `Rollback failed: The rollback file "${downFileName}" was not found for migration "${migrationName}".\n` +
          `Rollback halted.`
        );
      }

      const content = fs.readFileSync(downFilePath, 'utf8');

      if (dryRun) {
        logger.warn(`[DRY-RUN] Step ${i + 1}/${totalSteps}: Would rollback ${migrationName}`);
        summary.rolledBack++;
        continue;
      }

      logger.info(`Rolling back migration [${i + 1}/${totalSteps}]: ${migrationName}`);

      try {
        await this.adapter.begin();
        await this.adapter.query(content);
        await this.logTable.markAsRolledBack(this.adapter, migrationName);
        await this.adapter.commit();

        logger.success(`Success: Rolled back ${migrationName}`);
        summary.rolledBack++;
      } catch (error) {
        await this.adapter.rollback();

        let context = '';
        if (error.position) context += ` (at character ${error.position})`;
        if (error.detail) context += ` - ${error.detail}`;

        logger.error(`Rollback failed for ${migrationName}${context}`);
        logger.error(error.message);
        summary.failed++;
        throw error; // Halt execution on failure
      }
    }

    return summary;
  }
}
