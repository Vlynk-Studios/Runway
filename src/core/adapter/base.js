/**
 * Base Database Adapter Interface
 * All specific database adapters must extend this class and implement these methods.
 */
export class BaseAdapter {
  constructor(config) {
    this.config = config;
  }

  async connect() {
    throw new Error('Method connect not implemented');
  }

  async query(sql, params) {
    throw new Error('Method query not implemented');
  }

  async begin() {
    throw new Error('Method begin not implemented');
  }

  async commit() {
    throw new Error('Method commit not implemented');
  }

  async rollback() {
    throw new Error('Method rollback not implemented');
  }

  async end() {
    throw new Error('Method end not implemented');
  }
}
