/**
 * Base Database Adapter Interface
 */
export class BaseAdapter {
  async query(sql, params) { throw new Error('Not implemented'); }
  async begin() { throw new Error('Not implemented'); }
  async commit() { throw new Error('Not implemented'); }
  async rollback() { throw new Error('Not implemented'); }
  async end() { throw new Error('Not implemented'); }
}
