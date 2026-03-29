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
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await adapter.query(sql);
  }

  /**
   * Retrieves all applied migrations with their timestamps.
   */
  async getAppliedMigrations(adapter) {
    const sql = `SELECT name, checksum, applied_at FROM ${this.tableName} ORDER BY id ASC;`;
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
   * Deletes a migration record from the log table.
   */
  async deleteMigration(adapter, name) {
    const sql = `DELETE FROM ${this.tableName} WHERE name = $1;`;
    await adapter.query(sql, [name]);
  }
}
