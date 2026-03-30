import { MigrationRunner } from '../src/core/runner.js';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Creates a minimal mock adapter with a controllable query response. */
function createAdapter({ appliedRows = [], queryError = null } = {}) {
  return {
    _calls: [],
    async query(sql, _params) {
      this._calls.push(sql.trim());
      if (queryError) throw queryError;
      // getAppliedMigrations returns rows; everything else returns empty
      if (sql.trim().startsWith('SELECT')) return { rows: appliedRows };
      return { rows: [] };
    },
    async begin() { this._calls.push('BEGIN'); },
    async commit() { this._calls.push('COMMIT'); },
    async rollback() { this._calls.push('ROLLBACK'); },
  };
}

/** Minimal config pointing at the test fixtures directory. */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '__fixtures__/migrations');

const baseConfig = {
  migrationsDir: fixturesDir,
  schema: 'public',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MigrationRunner', () => {
  it('applies pending migrations and returns a summary', async () => {
    const adapter = createAdapter({ appliedRows: [] });
    const runner = new MigrationRunner(adapter, baseConfig);

    const result = await runner.run();
    
    expect(result.applied).toBeGreaterThan(0);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.details.length).toBe(result.applied);
    expect(result.details[0]).toHaveProperty('duration');
    expect(typeof result.details[0].duration).toBe('number');
    
    expect(adapter._calls).toContain('BEGIN');
    expect(adapter._calls).toContain('COMMIT');
  });

  it('skips already-applied migrations with matching checksum', async () => {
    // Pre-compute the expected checksum for the first fixture file
    const fs = await import('fs');
    const path = await import('path');
    const { calculateChecksum } = await import('../src/core/checksum.js');

    const files = fs.readdirSync(fixturesDir).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
    const firstFile = files[0];
    const content = fs.readFileSync(path.join(fixturesDir, firstFile), 'utf8');
    const checksum = calculateChecksum(content);

    const adapter = createAdapter({
      appliedRows: [{ name: firstFile, checksum }],
    });
    const runner = new MigrationRunner(adapter, baseConfig);

    const result = await runner.run();

    expect(result.skipped).toBe(1);
    expect(result.applied).toBe(files.length - 1);
  });

  it('throws on checksum mismatch (integrity violation)', async () => {
    const fs = await import('fs');
    const files = fs.readdirSync(fixturesDir).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
    const firstFile = files[0];

    const adapter = createAdapter({
      appliedRows: [{ name: firstFile, checksum: 'tampered_checksum' }],
    });
    const runner = new MigrationRunner(adapter, baseConfig);

    await expect(runner.run()).rejects.toThrow('Integrity violation');
  });

  it('dry-run: reports what would be applied without touching the DB', async () => {
    const adapter = createAdapter({ appliedRows: [] });
    const runner = new MigrationRunner(adapter, baseConfig);

    const result = await runner.run({ dryRun: true });

    expect(result.applied).toBeGreaterThan(0);
    // In dry-run, BEGIN/COMMIT must never be called
    expect(adapter._calls).not.toContain('BEGIN');
    expect(adapter._calls).not.toContain('COMMIT');
  });

  it('throws if the migrations directory does not exist', async () => {
    const adapter = createAdapter();
    const runner = new MigrationRunner(adapter, {
      ...baseConfig,
      migrationsDir: '/non/existent/path',
    });

    await expect(runner.run()).rejects.toThrow('Migrations directory not found');
  });

  it('reports zero applied migrations when everything is already up to date', async () => {
    // Mock that all migrations are applied
    const fs = await import('fs');
    const { calculateChecksum } = await import('../src/core/checksum.js');
    
    const files = fs.readdirSync(fixturesDir).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
    const appliedRows = files.map(f => {
      const content = fs.readFileSync(path.join(fixturesDir, f), 'utf8');
      return { name: f, checksum: calculateChecksum(content) };
    });

    const adapter = createAdapter({ appliedRows });
    const runner = new MigrationRunner(adapter, baseConfig);

    const result = await runner.run();

    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(files.length);
  });
});
