import mysql from 'mysql2/promise';
import { BaseAdapter } from './base.js';

/**
 * MySQL / MariaDB Database Adapter implementation.
 * Uses mysql2/promise to manage a dedicated connection for migrations.
 */
export class MySQLAdapter extends BaseAdapter {
  static instances = new Set();

  constructor(config) {
    super(config);
    this.connection = null;
  }

  /**
   * Initializes the connection to the database.
   * Supports both URL strings and structured configuration.
   */
  async connect() {
    const { database } = this.config;

    try {
      if (database.url) {
        this.connection = await mysql.createConnection(database.url);
      } else {
        const clientConfig = {
          host: database.host,
          port: database.port || 3306,
          user: database.user,
          password: database.password,
          database: database.database,
          ssl: database.ssl ? { rejectUnauthorized: false } : undefined,
          // Crucial for running full migration scripts with multiple lines/statements
          multipleStatements: true
        };
        this.connection = await mysql.createConnection(clientConfig);
      }
      MySQLAdapter.instances.add(this);
    } catch (error) {
      throw new Error(MySQLAdapter._classifyConnectionError(error), { cause: error });
    }
  }

  /**
   * Executes a database query.
   * Normalizes the return format to match PostreSQL adapter's { rows, rowCount } shape.
   */
  async query(sql, params) {
    if (!this.connection) {
      throw new Error('MySQLAdapter: Connection not established. Call connect() first.');
    }
    
    // We use .query() instead of .execute() because execute is for prepared statements
    // and typically doesn't support multipleStatements (which are needed for migration sets).
    const [rows, fields] = await this.connection.query(sql, params);
    
    // If the query was an INSERT/UPDATE/DELETE, mysql2 returns an object (ResultSetHeader), not an array.
    const isResultSetArray = Array.isArray(rows);
    
    return {
      rows: isResultSetArray ? rows : [rows],
      fields,
      rowCount: isResultSetArray ? rows.length : (rows.affectedRows || 0)
    };
  }

  /**
   * Transaction lifecycle: START TRANSACTION
   */
  async begin() {
    await this.query('START TRANSACTION');
  }

  /**
   * Transaction lifecycle: COMMIT
   */
  async commit() {
    await this.query('COMMIT');
  }

  /**
   * Transaction lifecycle: ROLLBACK
   */
  async rollback() {
    await this.query('ROLLBACK');
  }

  /**
   * Closes the database connection.
   */
  async end() {
    if (this.connection) {
      try {
        await this.connection.end();
      } finally {
        this.connection = null;
        MySQLAdapter.instances.delete(this);
      }
    }
  }

  /**
   * Static helper to close all active adapter connections.
   * Useful for graceful shutdown on process signals.
   */
  static async closeAll() {
    const active = Array.from(MySQLAdapter.instances);
    await Promise.all(active.map(adapter => adapter.end()));
  }

  /**
   * Translates a raw mysql2 connection error into a clear, actionable message.
   * Never leaks internal stack traces to the user.
   */
  static _classifyConnectionError(error) {
    const code = error.code;
    const msg = error.message || '';

    // Network-level errors
    if (code === 'ECONNREFUSED') {
      return (
        `Connection refused - the database server is not reachable at the configured host/port.\n` +
        `Check that DB_HOST and DB_PORT (or DATABASE_URL) are correct and the server is running.`
      );
    }
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      return (
        `Host not found - could not resolve the database hostname.\n` +
        `Verify that DB_HOST (or the host in DATABASE_URL) is spelled correctly.`
      );
    }
    if (code === 'ETIMEDOUT') {
      return (
        `Connection timed out - the database server did not respond in time.\n` +
        `Check your network, firewall rules, and DB_HOST / DB_PORT settings.`
      );
    }

    // Access denied / Auth errors
    if (code === 'ER_ACCESS_DENIED_ERROR') {
      return (
        `Authentication failed - the provided credentials were rejected by MySQL/MariaDB.\n` +
        `Check DB_USER and DB_PASSWORD (or the credentials in DATABASE_URL).`
      );
    }
    if (code === 'ER_BAD_DB_ERROR') {
      return (
        `Database not found - MySQL/MariaDB does not have a database with that name.\n` +
        `Check DB_NAME (or the database name in DATABASE_URL).`
      );
    }

    // Fallback: clean message without stack
    return `Failed to connect to MySQL/MariaDB: ${msg}`;
  }
}
