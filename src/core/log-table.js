import { logger } from '../logger.js';

/**
 * Manages the runway_migrations table in the database.
 */
export class LogTable {
  constructor(schema = 'public', dialect = 'postgres') {
    this.schema = schema;
    this.dialect = dialect;
    
    if (this.dialect === 'mysql' || this.dialect === 'mariadb') {
      if (schema && schema !== 'public') {
        logger.warn(`MySQL does not support schemas. The configured schema "${schema}" will be ignored.`);
      }
      this.tableName = `\`runway_migrations\``;
    } else {
      // Securely escape schema and table identifiers
      const escapedSchema = schema.replace(/"/g, '""');
      this.tableName = `"${escapedSchema}"."runway_migrations"`;
    }
  }

  /**
   * Helper to format query parameters placeholders
   */
  _p(index) {
    // MySQL/MariaDB (and conventionally SQLite) use ?
    if (['mysql', 'mariadb', 'sqlite'].includes(this.dialect)) {
      return '?';
    }
    return `$${index}`;
  }

  /**
   * Ensures the migrations log table exists.
   */
  async ensureTable(adapter) {
    let idColumnDef = 'id SERIAL PRIMARY KEY';
    if (this.dialect === 'mysql' || this.dialect === 'mariadb') {
      idColumnDef = 'id INT AUTO_INCREMENT PRIMARY KEY';
    } else if (this.dialect === 'sqlite') {
      idColumnDef = 'id INTEGER PRIMARY KEY AUTOINCREMENT';
    }

    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        ${idColumnDef},
        name VARCHAR(255) NOT NULL UNIQUE,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        rolled_back_at TIMESTAMP
      );
    `;
    await adapter.query(sql);

    // Ensure the rolled_back_at column exists for users upgrading from v0.1.0/v0.2.0
    if (this.dialect === 'mysql' || this.dialect === 'mariadb') {
      const checkSql = `
        SELECT COLUMN_NAME 
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() 
          AND table_name = 'runway_migrations' 
          AND column_name = 'rolled_back_at';
      `;
      const result = await adapter.query(checkSql);
      if (!result.rows || result.rows.length === 0) {
        await adapter.query(`ALTER TABLE ${this.tableName} ADD COLUMN rolled_back_at TIMESTAMP;`);
      }
    } else {
      const alterSql = `ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMP;`;
      await adapter.query(alterSql);
    }
  }

  /**
   * Retrieves all migration records from the history table.
   */
  async getAppliedMigrations(adapter) {
    const sql = `SELECT name, checksum, applied_at, rolled_back_at FROM ${this.tableName} ORDER BY id ASC;`;
    const result = await adapter.query(sql);
    return result.rows || [];
  }

  /**
   * Registers a new migration or updates an existing one (re-application after rollback).
   */
  async registerMigration(adapter, name, checksum) {
    let sql;
    
    if (this.dialect === 'mysql' || this.dialect === 'mariadb') {
      sql = `
        INSERT INTO ${this.tableName} (name, checksum, applied_at, rolled_back_at) 
        VALUES (${this._p(1)}, ${this._p(2)}, CURRENT_TIMESTAMP, NULL)
        ON DUPLICATE KEY UPDATE 
          checksum = VALUES(checksum),
          applied_at = CURRENT_TIMESTAMP,
          rolled_back_at = NULL;
      `;
    } else {
      sql = `
        INSERT INTO ${this.tableName} (name, checksum, applied_at, rolled_back_at) 
        VALUES (${this._p(1)}, ${this._p(2)}, CURRENT_TIMESTAMP, NULL)
        ON CONFLICT (name) DO UPDATE SET 
          checksum = EXCLUDED.checksum,
          applied_at = CURRENT_TIMESTAMP,
          rolled_back_at = NULL;
      `;
    }

    await adapter.query(sql, [name, checksum]);
  }

  /**
   * Marks a migration record as rolled back instead of deleting it.
   */
  async markAsRolledBack(adapter, name) {
    const sql = `UPDATE ${this.tableName} SET rolled_back_at = CURRENT_TIMESTAMP WHERE name = ${this._p(1)};`;
    await adapter.query(sql, [name]);
  }
}
