import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { MariaDbContainer } from '@testcontainers/mariadb';

/**
 * Integration Test: MariaDB Full Migration Lifecycle
 * 
 * MariaDB is compatible with the MySQL adapter but has its own container strategy.
 */
describe('Integration Test: MariaDB Full Migration Lifecycle', () => {
  let container;
  let dbUrl;
  let testProjectDir;
  let oldCwd;

  // Increase timeout for container startup
  jest.setTimeout(90000);

  beforeAll(async () => {
    // 1. Start real MariaDB container
    // MariaDB 10.11 is a stable LTS version
    container = await new MariaDbContainer('mariadb:10.11')
      .withDatabase('runway_test')
      .withUsername('tester')
      .withPassword('password')
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(3306);
    // Runway uses MySQL protocol for MariaDB since it uses the mysql2 driver
    dbUrl = `mysql://tester:password@${host}:${port}/runway_test`;
    
    // 2. Setup temporary project directory
    testProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runway-mariadb-integration-'));
    oldCwd = process.cwd();
    process.chdir(testProjectDir);

    // 3. Create .env file
    fs.writeFileSync(path.join(testProjectDir, '.env'), `DATABASE_URL="${dbUrl}"\n`);
  });

  afterAll(async () => {
    process.chdir(oldCwd);
    if (testProjectDir && fs.existsSync(testProjectDir)) {
      try {
        fs.rmSync(testProjectDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Failed to cleanup temp dir:', err);
      }
    }
    if (container) {
      await container.stop();
    }
  });

  it('performs a complete migration lifecycle on a real MariaDB database', async () => {
    const { init } = await import('../src/commands/init.js');
    const { create } = await import('../src/commands/create.js');
    const { migrate } = await import('../src/commands/migrate.js');
    const { rollback } = await import('../src/commands/rollback.js');
    const { baseline } = await import('../src/commands/baseline.js');

    const inquirer = (await import('inquirer')).default;
    jest.spyOn(inquirer, 'prompt');

    // --- STEP 1: INIT ---
    await init();
    expect(fs.existsSync(path.join(testProjectDir, 'runway.config.js'))).toBe(true);

    // --- STEP 2: CREATE ---
    await create('mariadb_init');
    
    const upFile = path.join(testProjectDir, 'migrations', '001_mariadb_init.sql');
    fs.writeFileSync(upFile, 'CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255));');
    const downFile = path.join(testProjectDir, 'migrations', '001_mariadb_init.down.sql');
    fs.writeFileSync(downFile, 'DROP TABLE users;');

    // --- STEP 3: MIGRATE ---
    await migrate({});

    // --- STEP 4: VERIFY ---
    const { MySQLAdapter } = await import('../src/core/adapter/mysql.js');
    const { config } = await import('../src/config.js');
    const adapter = new MySQLAdapter(config);
    await adapter.connect();
    
    const { rows: tables } = await adapter.query("SHOW TABLES");
    const tableNames = tables.map(r => Object.values(r)[0]);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('runway_migrations');

    // --- STEP 5: ROLLBACK ---
    await rollback({ steps: 1, yes: true });
    const { rows: tablesAfter } = await adapter.query("SHOW TABLES");
    expect(tablesAfter.map(r => Object.values(r)[0])).not.toContain('users');

    // --- STEP 6: BASELINE ---
    await create('manual_legacy');
    await adapter.query("CREATE TABLE legacy_data (id INT PRIMARY KEY, content TEXT);");
    await baseline('002', { yes: true });

    const { rows: history } = await adapter.query("SELECT version FROM runway_migrations WHERE version LIKE '%002%'");
    expect(history.length).toBe(1);

    await adapter.end();
  });
});
