/**
 * Manages the runway_migrations table in the database.
 */
export class LogTable {
  constructor(schema = 'public') {
    this.schema = schema;
    this.tableName = `"${schema}"."runway_migrations"`;
  }

  /**
   * Ensures the migrations log table exists.
   */
  async ensureTable(adapter) {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        rolled_back_at TIMESTAMP
      );
    `;
    await adapter.query(sql);

    // Ensure the rolled_back_at column exists for users upgrading from v0.1.0/v0.2.0
    const alterSql = `ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMP;`;
    await adapter.query(alterSql);
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
   * Registers a new migration in the log table.
   */
  async registerMigration(adapter, name, checksum) {
    const sql = `INSERT INTO ${this.tableName} (name, checksum) VALUES ($1, $2);`;
    await adapter.query(sql, [name, checksum]);
  }

  /**
   * Marks a migration record as rolled back instead of deleting it.
   */
  async markAsRolledBack(adapter, name) {
    const sql = `UPDATE ${this.tableName} SET rolled_back_at = CURRENT_TIMESTAMP WHERE name = $1;`;
    await adapter.query(sql, [name]);
  }
}
