import pg from 'pg';
import { BaseAdapter } from './base.js';

const { Client } = pg;

/**
 * PostgreSQL Database Adapter implementation.
 * Uses pg.Client to manage a dedicated connection for migrations.
 */
export class PostgresAdapter extends BaseAdapter {
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
    } catch (error) {
      throw new Error(`Failed to connect to PostgreSQL: ${error.message}`, { cause: error });
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
      await this.client.end();
      this.client = null;
    }
  }
}
