import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

// We'll use the actual commands, but we need to manage the environment carefully
// because they rely on process.cwd(), .env files, etc.

describe('Integration Test: Full Migration Lifecycle', () => {
  let container;
  let dbUrl;
  let testProjectDir;
  let oldCwd;

  // Increase timeout for container startup
  jest.setTimeout(300000);

  beforeAll(async () => {
    // 1. Setup temporary project directory
    testProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runway-postgres-integration-'));
    oldCwd = process.cwd();
    process.chdir(testProjectDir);

    // 2. Start real PostgreSQL container
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('runway_test')
      .withUsername('tester')
      .withPassword('password')
      .start();

    dbUrl = container.getConnectionUri();

    // 3. Create .env file
    fs.writeFileSync(path.join(testProjectDir, '.env'), `DATABASE_URL="${dbUrl}"\n`);
    
    // 4. IMPORTANT: Refresh config after changing CWD and setting .env
    // This allows the ESM-cached config to pick up the new project dir
    const { refreshConfig } = await import('../src/config.js');
    await refreshConfig();
  });

  afterAll(async () => {
    process.chdir(oldCwd);
    // Cleanup temp dir
    if (testProjectDir && fs.existsSync(testProjectDir)) {
      fs.rmSync(testProjectDir, { recursive: true, force: true });
    }
    // Stop container
    if (container) {
      await container.stop();
    }
  });

  it('performs a complete migration lifecycle on a real database', async () => {
    // Dynamically import commands to ensure they pick up the new CWD/Env
    // Note: We need to bypass some logger outputs or mock them to avoid cluttering the test run
    const { init } = await import('../src/commands/init.js');
    const { create } = await import('../src/commands/create.js');
    const { migrate } = await import('../src/commands/migrate.js');
    await import('../src/commands/status.js');
    const { rollback } = await import('../src/commands/rollback.js');
    const { baseline } = await import('../src/commands/baseline.js');

    // Mocks for interactive prompts
    const inquirer = (await import('inquirer')).default;
    jest.spyOn(inquirer, 'prompt');

    // --- STEP 1: INIT ---
    // Should detect the .env URL and skip prompts
    await init();
    expect(fs.existsSync(path.join(testProjectDir, 'runway.config.js'))).toBe(true);
    expect(fs.existsSync(path.join(testProjectDir, 'migrations'))).toBe(true);

    // --- STEP 2: CREATE ---
    await create('initial_schema');
    await create('add_users_table');
    
    const migrationFiles = fs.readdirSync(path.join(testProjectDir, 'migrations'));
    expect(migrationFiles.length).toBe(4); // 2 .up.sql and 2 .down.sql

    // Fill them with some real SQL
    const upFile = path.join(testProjectDir, 'migrations', '001_initial_schema.sql');
    fs.writeFileSync(upFile, 'CREATE TABLE audit_log (id SERIAL PRIMARY KEY, msg TEXT);');
    
    const upFile2 = path.join(testProjectDir, 'migrations', '002_add_users_table.sql');
    fs.writeFileSync(upFile2, 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);');
    const downFile2 = path.join(testProjectDir, 'migrations', '002_add_users_table.down.sql');
    fs.writeFileSync(downFile2, 'DROP TABLE users;');

    // --- STEP 3: MIGRATE (UP) ---
    await migrate({}); // Should apply both

    // --- STEP 4: STATUS ---
    // We can't easily check log output here without more complex spies, 
    // but we can verify the DB state
    const { PostgresAdapter } = await import('../src/core/adapter/postgres.js');
    const { config } = await import('../src/config.js');
    const adapter = new PostgresAdapter(config);
    await adapter.connect();
    
    const tables = await adapter.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
    const tableNames = tables.rows.map(r => r.tablename);
    expect(tableNames).toContain('audit_log');
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('runway_migrations');

    const history = await adapter.query("SELECT * FROM runway_migrations");
    expect(history.rows.length).toBe(2);

    // --- STEP 5: ROLLBACK ---
    await rollback({ steps: 1 });
    
    const tablesAfterRollback = await adapter.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
    const tableNamesAfter = tablesAfterRollback.rows.map(r => r.tablename);
    expect(tableNamesAfter).not.toContain('users');
    expect(tableNamesAfter).toContain('audit_log');

    // --- STEP 6: BASELINE ---
    // Create a new migration that we'll baseline
    await create('manual_change');
    // Simulate manual DB change
    await adapter.query("CREATE TABLE settings (key TEXT, val TEXT);");
    await baseline('003', {});

    const historyAfterBaseline = await adapter.query("SELECT name FROM runway_migrations ORDER BY name ASC");
    expect(historyAfterBaseline.rows.map(r => r.name)).toContain('003_manual_change.sql');

    await adapter.end();
  });
});
