import { jest } from '@jest/globals';

// --- Mocks ---
jest.unstable_mockModule('../src/logger.js', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  }
}));

const { logger } = await import('../src/logger.js');
const { LogTable } = await import('../src/core/log-table.js');

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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('defaults to the public schema and postgres dialect', () => {
      const t = new LogTable();
      expect(t.schema).toBe('public');
      expect(t.dialect).toBe('postgres');
      expect(t.tableName).toBe('"public"."runway_migrations"');
    });

    it('uses the provided schema in postgres', () => {
      const t = new LogTable('custom', 'postgres');
      expect(t.tableName).toBe('"custom"."runway_migrations"');
    });

    it('uses backticks and ignores schema in mysql', () => {
      const t = new LogTable('public', 'mysql');
      expect(t.tableName).toBe('`runway_migrations`');
    });

    it('warns when a non-public schema is provided in mysql', () => {
      const t = new LogTable('custom_schema', 'mysql');
      expect(t.tableName).toBe('`runway_migrations`');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('MySQL does not support schemas')
      );
    });
  });

  describe('_p', () => {
    it('returns $index for postgres', () => {
      const t = new LogTable('public', 'postgres');
      expect(t._p(1)).toBe('$1');
      expect(t._p(5)).toBe('$5');
    });

    it('returns ? for mysql', () => {
      const t = new LogTable('public', 'mysql');
      expect(t._p(1)).toBe('?');
    });

    it('returns ? for mariadb', () => {
      const t = new LogTable('public', 'mariadb');
      expect(t._p(1)).toBe('?');
    });

    it('returns ? for sqlite', () => {
      const t = new LogTable('public', 'sqlite');
      expect(t._p(1)).toBe('?');
    });
  });

  describe('ensureTable', () => {
    it('executes CREATE TABLE and ALTER TABLE for postgres', async () => {
      const adapter = createMockAdapter();
      const t = new LogTable('public', 'postgres');
      await t.ensureTable(adapter);

      expect(adapter.queries).toHaveLength(2);
      expect(adapter.queries[0].sql).toContain('id SERIAL PRIMARY KEY');
      expect(adapter.queries[1].sql).toContain('ADD COLUMN IF NOT EXISTS rolled_back_at');
    });

    it('executes CREATE TABLE and information_schema check for mysql', async () => {
      const adapter = createMockAdapter([]); // Simulate column not existing
      const t = new LogTable('public', 'mysql');
      await t.ensureTable(adapter);

      expect(adapter.queries).toHaveLength(3);
      expect(adapter.queries[0].sql).toContain('id INT AUTO_INCREMENT PRIMARY KEY');
      expect(adapter.queries[1].sql).toContain('FROM information_schema.columns');
      expect(adapter.queries[2].sql).toContain('ADD COLUMN rolled_back_at');
    });

    it('skips ALTER TABLE for mysql if column already exists', async () => {
      const adapter = createMockAdapter([{ COLUMN_NAME: 'rolled_back_at' }]);
      const t = new LogTable('public', 'mysql');
      await t.ensureTable(adapter);

      expect(adapter.queries).toHaveLength(2); // CREATE and SELECT check, no ALTER
      expect(adapter.queries[1].sql).toContain('FROM information_schema.columns');
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
  });

  describe('registerMigration', () => {
    it('executes an UPSERT (ON CONFLICT) for postgres', async () => {
      const adapter = createMockAdapter();
      const t = new LogTable('public', 'postgres');
      await t.registerMigration(adapter, '001_init.sql', 'deadbeef');

      expect(adapter.queries).toHaveLength(1);
      expect(adapter.queries[0].sql).toContain('ON CONFLICT (name) DO UPDATE SET');
      expect(adapter.queries[0].sql).toContain('$1, $2');
      expect(adapter.queries[0].params).toEqual(['001_init.sql', 'deadbeef']);
    });

    it('executes an UPSERT (ON DUPLICATE KEY UPDATE) for mysql', async () => {
      const adapter = createMockAdapter();
      const t = new LogTable('public', 'mysql');
      await t.registerMigration(adapter, '001_init.sql', 'deadbeef');

      expect(adapter.queries).toHaveLength(1);
      expect(adapter.queries[0].sql).toContain('ON DUPLICATE KEY UPDATE');
      expect(adapter.queries[0].sql).toContain('?, ?');
      expect(adapter.queries[0].params).toEqual(['001_init.sql', 'deadbeef']);
    });
  });

  describe('markAsRolledBack', () => {
    it('updates rolled_back_at using correct placeholder', async () => {
      const adapter = createMockAdapter();
      const t = new LogTable('public', 'mysql');
      await t.markAsRolledBack(adapter, '001_init.sql');

      expect(adapter.queries[0].sql).toContain('UPDATE `runway_migrations`');
      expect(adapter.queries[0].sql).toContain('WHERE name = ?');
    });
  });
});
