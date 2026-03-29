import { LogTable } from '../src/core/log-table.js';

// Minimal mock adapter that records queries
function createMockAdapter(rows = []) {
  return {
    queries: [],
    async query(sql, params) {
      this.queries.push({ sql: sql.trim(), params });
      return { rows };
    },
  };
}

describe('LogTable', () => {
  describe('constructor', () => {
    it('defaults to the public schema', () => {
      const t = new LogTable();
      expect(t.schema).toBe('public');
      expect(t.tableName).toBe('"public"."runway_migrations"');
    });

    it('uses the provided schema', () => {
      const t = new LogTable('custom');
      expect(t.tableName).toBe('"custom"."runway_migrations"');
    });
  });

  describe('ensureTable', () => {
    it('executes CREATE TABLE and ALTER TABLE statements', async () => {
      const adapter = createMockAdapter();
      const t = new LogTable();
      await t.ensureTable(adapter);

      expect(adapter.queries).toHaveLength(2);
      expect(adapter.queries[0].sql).toContain('CREATE TABLE IF NOT EXISTS');
      expect(adapter.queries[1].sql).toContain('ALTER TABLE');
      expect(adapter.queries[1].sql).toContain('ADD COLUMN IF NOT EXISTS rolled_back_at');
    });
  });

  describe('getAppliedMigrations', () => {
    it('returns the rows from the query result', async () => {
      const mockRows = [
        { name: '001_init.sql', checksum: 'abc', applied_at: '2025-01-01', rolled_back_at: null },
      ];
      const adapter = createMockAdapter(mockRows);
      const t = new LogTable();

      const result = await t.getAppliedMigrations(adapter);
      expect(result).toEqual(mockRows);
    });

    it('returns an empty array when no rows exist', async () => {
      const adapter = createMockAdapter([]);
      const t = new LogTable();
      const result = await t.getAppliedMigrations(adapter);
      expect(result).toEqual([]);
    });
  });

  describe('registerMigration', () => {
    it('executes an UPSERT (ON CONFLICT) with name and checksum parameters', async () => {
      const adapter = createMockAdapter();
      const t = new LogTable();
      await t.registerMigration(adapter, '001_init.sql', 'deadbeef');

      expect(adapter.queries).toHaveLength(1);
      expect(adapter.queries[0].sql).toContain('INSERT INTO');
      expect(adapter.queries[0].sql).toContain('ON CONFLICT (name)');
      expect(adapter.queries[0].params).toEqual(['001_init.sql', 'deadbeef']);
    });
  });
});
