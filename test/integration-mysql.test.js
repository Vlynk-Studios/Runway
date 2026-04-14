import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { MySqlContainer } from '@testcontainers/mysql';

/**
 * Integration Test: MySQL Full Migration Lifecycle
 * 
 * This test uses a real MySQL Docker container to verify that Runway
 * correctly manages the database state.
 */
describe('Integration Test: MySQL Full Migration Lifecycle', () => {
  let container;
  let dbUrl;
  let testProjectDir;
  let oldCwd;

  // Increase timeout for container startup and image pull
  jest.setTimeout(90000);

  beforeAll(async () => {
    // 1. Start real MySQL container
    // We use 8.0 as it's a very stable and common version
    container = await new MySqlContainer('mysql:8.0')
      .withDatabase('runway_test')
      .withUsername('tester')
      .withUserPassword('password')
      .withRootPassword('root_password')
      .start();

    // MySQL default port is 3306
    const host = container.getHost();
    const port = container.getMappedPort(3306);
    dbUrl = `mysql://tester:password@${host}:${port}/runway_test`;
    
    // 2. Setup temporary project directory to avoid polluting the workspace
    testProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runway-mysql-integration-'));
    oldCwd = process.cwd();
    process.chdir(testProjectDir);

    // 3. Create .env file with the container's URL
    // Runway's config (src/config.js) looks for DATABASE_URL by default
    fs.writeFileSync(path.join(testProjectDir, '.env'), `DATABASE_URL="${dbUrl}"\n`);
  });

  afterAll(async () => {
    process.chdir(oldCwd);
    // Cleanup temporary files
    if (testProjectDir && fs.existsSync(testProjectDir)) {
      try {
        fs.rmSync(testProjectDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Failed to cleanup temp dir:', err);
      }
    }
    // Stop and remove the Docker container
    if (container) {
      await container.stop();
    }
  });

  it('performs a complete migration lifecycle on a real MySQL database', async () => {
    // Dynamically import commands to ensure they pick up the new CWD/Env
    const { init } = await import('../src/commands/init.js');
    const { create } = await import('../src/commands/create.js');
    const { migrate } = await import('../src/commands/migrate.js');
    const { rollback } = await import('../src/commands/rollback.js');
    const { baseline } = await import('../src/commands/baseline.js');

    // Mock interactive prompts - Runway should skip most of them if it finds .env
    const inquirer = (await import('inquirer')).default;
    jest.spyOn(inquirer, 'prompt');

    // --- STEP 1: INIT ---
    // Should detect dialect from URL and initialize runway.config.js
    await init();
    expect(fs.existsSync(path.join(testProjectDir, 'runway.config.js'))).toBe(true);
    expect(fs.existsSync(path.join(testProjectDir, 'migrations'))).toBe(true);

    // --- STEP 2: CREATE ---
    await create('initial_schema');
    await create('add_products_table');
    
    const migrationFiles = fs.readdirSync(path.join(testProjectDir, 'migrations'));
    // We expect 4 files: 2 .up.sql and 2 .down.sql
    expect(migrationFiles.length).toBe(4);

    // Fill migrations with real MySQL SQL
    const upFile1 = path.join(testProjectDir, 'migrations', '001_initial_schema.sql');
    fs.writeFileSync(upFile1, 'CREATE TABLE audit_log (id INT AUTO_INCREMENT PRIMARY KEY, msg TEXT);');
    
    const upFile2 = path.join(testProjectDir, 'migrations', '002_add_products_table.sql');
    fs.writeFileSync(upFile2, 'CREATE TABLE products (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255));');
    const downFile2 = path.join(testProjectDir, 'migrations', '002_add_products_table.down.sql');
    fs.writeFileSync(downFile2, 'DROP TABLE products;');

    // --- STEP 3: MIGRATE (UP) ---
    // This will connect to MySQL and run the 001 and 002 scripts
    await migrate({});

    // --- STEP 4: VERIFY DB STATE ---
    const { MySQLAdapter } = await import('../src/core/adapter/mysql.js');
    const { config } = await import('../src/config.js');
    // Using the same config logic Runway uses
    const adapter = new MySQLAdapter(config);
    await adapter.connect();
    
    // Check if tables exist
    const { rows: tables } = await adapter.query("SHOW TABLES");
    // MySQL returns column names like 'Tables_in_runway_test'
    const tableNames = tables.map(r => Object.values(r)[0]);
    
    expect(tableNames).toContain('audit_log');
    expect(tableNames).toContain('products');
    expect(tableNames).toContain('runway_migrations');

    // Check migration history
    const { rows: history } = await adapter.query("SELECT * FROM runway_migrations");
    expect(history.length).toBe(2);

    // --- STEP 5: ROLLBACK ---
    // Rollback the last migration (products table)
    await rollback({ steps: 1, yes: true });
    
    const { rows: tablesAfterRollback } = await adapter.query("SHOW TABLES");
    const tableNamesAfter = tablesAfterRollback.map(r => Object.values(r)[0]);
    
    expect(tableNamesAfter).not.toContain('products');
    expect(tableNamesAfter).toContain('audit_log');

    // --- STEP 6: BASELINE ---
    // Baseline is used when you have manual changes or existing schema that 
    // you want to consider "already applied" without running the scripts.
    await create('manual_feature');
    const { rows: historyBeforeBaseline } = await adapter.query("SELECT COUNT(*) as count FROM runway_migrations");
    const countBefore = historyBeforeBaseline[0].count;

    // Simulate a manual DB change
    await adapter.query("CREATE TABLE settings (id INT PRIMARY KEY, val TEXT);");
    
    // Baseline migration '003'
    await baseline('003', { yes: true });

    const { rows: historyAfterBaseline } = await adapter.query("SELECT version FROM runway_migrations ORDER BY id DESC LIMIT 1");
    // Verify it was registered in the log table
    expect(historyAfterBaseline[0].version).toContain('003');
    
    // Verify count increased by 1
    const { rows: historyCountAfter } = await adapter.query("SELECT COUNT(*) as count FROM runway_migrations");
    expect(historyCountAfter[0].count).toBe(countBefore + 1);

    // --- STEP 7: DIALECT-SPECIFIC LOGTABLE VERIFICATION ---
    // Verify that the LogTable created the MySQL-specific structure correctly
    const { rows: tableInfo } = await adapter.query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY 
      FROM information_schema.columns 
      WHERE table_name = 'runway_migrations' AND table_schema = 'runway_test'
    `);
    
    const idColumn = tableInfo.find(c => c.COLUMN_NAME === 'id');
    const nameColumn = tableInfo.find(c => c.COLUMN_NAME === 'name');
    
    expect(idColumn.DATA_TYPE).toBe('int');
    expect(idColumn.COLUMN_KEY).toBe('PRI');
    expect(nameColumn.COLUMN_KEY).toEqual(expect.stringMatching(/UNI|MUL/)); // MySQL unique index

    await adapter.end();
  });
});
