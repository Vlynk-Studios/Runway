import { MigrationRunner } from '../src/core/runner.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { calculateChecksum } from '../src/core/checksum.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '__fixtures__/migrations');

const baseConfig = {
  migrationsDir: fixturesDir,
  schema: 'public',
};

function createAdapter({ appliedRows = [] } = {}) {
  return {
    _calls: [],
    async query(sql, _params) {
      if (sql.trim().startsWith('SELECT')) return { rows: appliedRows };
      return { rows: [] };
    },
    async begin() {},
    async commit() {},
    async rollback() {},
  };
}

describe('MigrationRunner.validate', () => {
  it('passes if no migrations are applied', async () => {
    const adapter = createAdapter({ appliedRows: [] });
    const runner = new MigrationRunner(adapter, baseConfig);
    const result = await runner.validate();
    expect(result).toEqual([]);
  });

  it('passes if all applied migrations match disk checksums', async () => {
    const files = fs.readdirSync(fixturesDir).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
    const appliedRows = files.map(file => {
      const content = fs.readFileSync(path.join(fixturesDir, file), 'utf8');
      return { name: file, checksum: calculateChecksum(content) };
    });

    const adapter = createAdapter({ appliedRows });
    const runner = new MigrationRunner(adapter, baseConfig);
    const result = await runner.validate();
    
    expect(result).toHaveLength(files.length);
    expect(result[0]).toMatchObject({
      name: files[0],
      status: 'PASSED'
    });
  });

  it('throws an error if an applied migration is missing on disk', async () => {
    const appliedRows = [{ name: '999_missing.sql', checksum: 'fake_checksum' }];
    const adapter = createAdapter({ appliedRows });
    const runner = new MigrationRunner(adapter, baseConfig);
    
    await expect(runner.validate()).rejects.toThrow('Validation failed: Applied migration "999_missing.sql" is missing on disk.');
  });

  it('throws an error on checksum mismatch', async () => {
    const files = fs.readdirSync(fixturesDir).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
    const firstFile = files[0];
    const appliedRows = [{ name: firstFile, checksum: 'invalid_checksum_value' }];
    
    const adapter = createAdapter({ appliedRows });
    const runner = new MigrationRunner(adapter, baseConfig);

    await expect(runner.validate()).rejects.toThrow('Validation failed: Checksum mismatch for applied migration');
  });
});
