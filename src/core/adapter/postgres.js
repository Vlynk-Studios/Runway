import pg from 'pg';
import { BaseAdapter } from './base.js';

const { Client } = pg;

/**
 * PostgreSQL Database Adapter implementation.
 * Uses pg.Client to manage a dedicated connection for migrations.
 */
export class PostgresAdapter extends BaseAdapter {
  static instances = new Set();

  constructor(config) {
    super(config);
    this.client = null;
  }

  /**
   * Initializes the client and connects to the database.
   * Supports both DATABASE_URL and structured credentials.
   */
  async connect() {
    const { database } = this.config;
    
    // Resolve connection configuration
    const clientConfig = database.url 
      ? { connectionString: database.url } 
      : {
          host: database.host,
          port: database.port,
          user: database.user,
          password: database.password,
          database: database.database,
          ssl: database.ssl,
        };

    try {
      this.client = new Client(clientConfig);
      await this.client.connect();
      PostgresAdapter.instances.add(this);
    } catch (error) {
      throw new Error(PostgresAdapter._classifyConnectionError(error), { cause: error });
    }
  }

  /**
   * Executes a database query.
   */
  async query(sql, params) {
    if (!this.client) {
      throw new Error('PostgresAdapter: Client not connected. Call connect() first.');
    }
    return await this.client.query(sql, params);
  }

  /**
   * Transaction lifecycle: BEGIN
   */
  async begin() {
    await this.query('BEGIN');
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
    if (this.client) {
      try {
        await this.client.end();
      } finally {
        this.client = null;
        PostgresAdapter.instances.delete(this);
      }
    }
  }

  /**
   * Static helper to close all active adapter connections.
   * Useful for graceful shutdown on process signals.
   */
  static async closeAll() {
    const active = Array.from(PostgresAdapter.instances);
    await Promise.all(active.map(adapter => adapter.end()));
  }

  /**
   * Translates a raw pg/Node connection error into a clear, actionable message.
   * Never leaks internal stack traces to the user.
   * @param {Error} error - The original error thrown during connect().
   * @returns {string}
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

    // PostgreSQL auth / database errors (SQLSTATE codes)
    if (code === '28P01' || code === '28000') {
      return (
        `Authentication failed - the provided credentials were rejected by PostgreSQL.\n` +
        `Check DB_USER and DB_PASSWORD (or the credentials in DATABASE_URL).`
      );
    }
    if (code === '3D000') {
      return (
        `Database not found - PostgreSQL does not have a database with that name.\n` +
        `Check DB_NAME (or the database name in DATABASE_URL).`
      );
    }
    if (code === '57P03') {
      return `The database server is starting up - please try again in a moment.`;
    }

    // SSL errors
    if (msg.toLowerCase().includes('ssl')) {
      return (
        `SSL connection error - the server may not support SSL, or the certificate is invalid.\n` +
        `Try setting DB_SSL=false or verifying your SSL configuration.`
      );
    }

    // Fallback: clean message without stack
    return `Failed to connect to PostgreSQL: ${msg}`;
  }
}
