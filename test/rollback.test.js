import fs from 'fs';
import path from 'path';
import os from 'os';
import { MigrationRunner } from '../src/core/runner.js';

describe('MigrationRunner - Rollback', () => {
  let tempDir;
  let adapter;
  let runner;
  let config;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runway-test-'));
    fs.writeFileSync(path.join(tempDir, '001_test.sql'), 'UP 1');
    fs.writeFileSync(path.join(tempDir, '001_test.down.sql'), 'DOWN 1');
    fs.writeFileSync(path.join(tempDir, '002_other.sql'), 'UP 2');
    fs.writeFileSync(path.join(tempDir, '002_other.down.sql'), 'DOWN 2');

    config = {
      migrationsDir: tempDir,
      schema: 'public',
    };

    adapter = {
      _calls: [],
      _applied: [
        { name: '001_test.sql', checksum: 'abc' },
        { name: '002_other.sql', checksum: 'def' }
      ],
      async query(sql, params) {
        const normalizedSql = sql.trim().replace(/\s+/g, ' ');
        this._calls.push({ sql: normalizedSql, params });
        
        if (normalizedSql.includes('SELECT name, checksum, applied_at')) {
          return { rows: [...this._applied] };
        }
        
        if (normalizedSql.includes('UPDATE') && normalizedSql.includes('rolled_back_at')) {
          const name = params[0];
          this._applied = this._applied.filter(a => a.name !== name);
        }
        
        return { rows: [] };
      },
      async begin() { this._calls.push('BEGIN'); },
      async commit() { this._calls.push('COMMIT'); },
      async rollback() { this._calls.push('ROLLBACK'); },
      async end() {}
    };

    runner = new MigrationRunner(adapter, config);
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rolls back the last migration successfully (1 step)', async () => {
    const result = await runner.rollback({ steps: 1 });
    
    expect(result.rolledBack).toBe(1);
    // Check that DOWN 2 was executed
    expect(adapter._calls.some(c => c.sql && c.sql.includes('DOWN 2'))).toBe(true);
    // Check that it was marked as rolled back
    expect(adapter._calls.some(c => c.sql && c.sql.includes('UPDATE') && c.params[0] === '002_other.sql')).toBe(true);
    expect(adapter._calls).toContain('BEGIN');
    expect(adapter._calls).toContain('COMMIT');
  });

  it('rolls back multiple steps successfully', async () => {
    const result = await runner.rollback({ steps: 2 });
    
    expect(result.rolledBack).toBe(2);
    expect(adapter._calls.some(c => c.sql && c.sql.includes('DOWN 2'))).toBe(true);
    expect(adapter._calls.some(c => c.sql && c.sql.includes('DOWN 1'))).toBe(true);
    expect(adapter._applied.length).toBe(0);
  });

  it('dry-run: reports what would happen without touching the DB', async () => {
    const result = await runner.rollback({ steps: 2, dryRun: true });
    
    expect(result.rolledBack).toBe(2);
    expect(adapter._calls).not.toContain('BEGIN');
    expect(adapter._calls.some(c => c.sql && c.sql.includes('UPDATE'))).toBe(false);
    // Check that migrations are still "applied" in the mock
    expect(adapter._applied.length).toBe(2);
  });

  it('throws error if .down.sql file is missing', async () => {
    fs.unlinkSync(path.join(tempDir, '002_other.down.sql'));
    
    await expect(runner.rollback()).rejects.toThrow('was not found');
    expect(adapter._calls).not.toContain('COMMIT');
  });

  it('reports nothing if no migrations are applied', async () => {
    adapter._applied = [];
    const result = await runner.rollback();
    
    expect(result.rolledBack).toBe(0);
  });

  it('stops immediately if a migration fails and rolls back the transaction', async () => {
    const originalQuery = adapter.query;
    adapter.query = async function(sql, params) {
      if (sql.includes('DOWN 2')) {
        throw new Error('Database Error');
      }
      return originalQuery.call(this, sql, params);
    };

    await expect(runner.rollback()).rejects.toThrow('Database Error');
    expect(adapter._calls).toContain('ROLLBACK');
    expect(adapter._calls).not.toContain('COMMIT');
  });
});
