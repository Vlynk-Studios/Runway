import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs';

// Mocking ESM modules before importing them
jest.unstable_mockModule('inquirer', () => ({
  default: {
    prompt: jest.fn(),
  },
}));

jest.unstable_mockModule('pg', () => {
  const Client = jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn().mockResolvedValue(undefined),
  }));
  return {
    default: { Client },
  };
});

jest.unstable_mockModule('ora', () => ({
  default: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    text: '',
  })),
}));

// Mocking config to avoid reading real files/env
jest.unstable_mockModule('../src/config.js', () => ({
  config: {
    migrationsDir: './migrations',
    schema: 'public',
    dialect: 'postgres',
    database: {
      url: 'postgresql://user:pass@localhost:5432/db',
    },
  },
  validateDatabaseConfig: jest.fn(),
}));

// Import commands after mocks
const { init } = await import('../src/commands/init.js');
const { create } = await import('../src/commands/create.js');
const { migrate } = await import('../src/commands/migrate.js');
const { baseline } = await import('../src/commands/baseline.js');
const { rollback } = await import('../src/commands/rollback.js');
const { status } = await import('../src/commands/status.js');
const { logger } = await import('../src/logger.js');
const pg = (await import('pg')).default;
const inquirer = (await import('inquirer')).default;

describe('End-to-End Flows (v0.3.0)', () => {
  let mockCwd;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCwd = path.resolve('/fake/project');
    jest.spyOn(process, 'cwd').mockReturnValue(mockCwd);
    jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called'); });
    
    // Mock logger
    jest.spyOn(logger, 'success').mockImplementation(() => {});
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    jest.spyOn(logger, 'suggest').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    
    // Mock fs functions
    jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
      if (p.includes('templates')) return true;
      return false;
    });
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    jest.spyOn(fs, 'readFileSync').mockReturnValue('// url: process.env.DATABASE_URL');
    jest.spyOn(fs, 'readdirSync').mockReturnValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Flow 1: New Project (Zero to Hero)', () => {
    it('initializes a new project without a database', async () => {
      inquirer.prompt.mockResolvedValue({
        hasDatabase: false,
        setupEnv: false
      });

      await init();

      expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(mockCwd, 'migrations'), { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith(path.join(mockCwd, 'runway.config.js'), expect.any(String));
      expect(logger.suggest).toHaveBeenCalledWith(expect.stringContaining('runway create create-users-table'));
    });

    it('creates migrations with proper naming (hyphens, lowercase, prefix)', async () => {
      fs.readdirSync.mockReturnValue(['001_init.sql']);
      fs.existsSync.mockImplementation((p) => p.includes('migrations'));

      await create('Add Profile Table');

      const calls = fs.writeFileSync.mock.calls;
      const mainMigration = calls.find(c => c[0].endsWith('002_add-profile-table.sql'));
      const downMigration = calls.find(c => c[0].endsWith('002_add-profile-table.down.sql'));

      expect(mainMigration).toBeDefined();
      expect(downMigration).toBeDefined();
    });

    it('runs migrations (migrate) and respects boundaries', async () => {
      fs.readdirSync.mockReturnValue(['001_init.sql', '002_users.sql', '003_posts.sql']);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((p) => {
        if (p.endsWith('001_init.sql')) return 'CREATE TABLE init;';
        if (p.endsWith('002_users.sql')) return 'CREATE TABLE users;';
        if (p.endsWith('003_posts.sql')) return 'CREATE TABLE posts;';
        return '';
      });

      const mockQuery = jest.fn().mockImplementation((sql) => {
        if (sql.includes('SELECT name FROM public.runway_migrations')) return { rows: [] };
        return { rows: [] };
      });
      const mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        query: mockQuery,
        end: jest.fn().mockResolvedValue(undefined),
      };
      pg.Client.mockImplementation(() => mockClient);

      await migrate({ to: 2 });

      expect(mockQuery).toHaveBeenCalledWith('BEGIN', undefined);
      expect(mockQuery).toHaveBeenCalledWith('CREATE TABLE init;', undefined);
      expect(mockQuery).toHaveBeenCalledWith('CREATE TABLE users;', undefined);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO "public"."runway_migrations"'), expect.arrayContaining(['001_init.sql']));
      expect(mockQuery).toHaveBeenCalledWith('COMMIT', undefined);
      expect(mockQuery).not.toHaveBeenCalledWith('CREATE TABLE posts;', undefined);
    });
  });

  describe('Flow 2: Existing Project (Integration)', () => {
    it('baselines an existing database up to a specific version', async () => {
      fs.readdirSync.mockReturnValue(['001_init.sql', '002_users.sql', '003_posts.sql']);
      fs.existsSync.mockReturnValue(true);
      
      const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
      const mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        query: mockQuery,
        end: jest.fn().mockResolvedValue(undefined),
      };
      pg.Client.mockImplementation(() => mockClient);

      await baseline(2);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO "public"."runway_migrations"'), expect.arrayContaining(['001_init.sql']));
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO "public"."runway_migrations"'), expect.arrayContaining(['002_users.sql']));
      expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO "public"."runway_migrations"'), expect.arrayContaining(['003_posts.sql']));
      expect(mockQuery).not.toHaveBeenCalledWith('CREATE TABLE init;', undefined);
    });
  });

  describe('Flow 3: Rollback and Status Integration', () => {
    it('rolls back migrations and verifies status output', async () => {
      // Mock an existing history for testing rollback and status
      fs.readdirSync.mockReturnValue(['001_init.sql', '002_users.sql']);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((p) => {
        if (p.endsWith('002_users.down.sql')) return 'DROP TABLE users;';
        if (p.endsWith('001_init.down.sql')) return 'DROP TABLE init;';
        return '';
      });

      const mockQuery = jest.fn().mockImplementation((sql) => {
        if (sql.includes('SELECT name')) {
          return { rows: [
            { name: '001_init.sql', checksum: 'abc', applied_at: new Date('2026-03-30T10:00:00Z') },
            { name: '002_users.sql', checksum: 'def', applied_at: new Date('2026-03-30T11:00:00Z') }
          ]};
        }
        return { rows: [] };
      });
      const mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        query: mockQuery,
        end: jest.fn().mockResolvedValue(undefined),
      };
      pg.Client.mockImplementation(() => mockClient);

      // 1. Run rollback
      inquirer.prompt.mockResolvedValueOnce({ confirm: true });
      
      await rollback({ steps: 1, yes: true });

      // Ensure the down migration was executed and the record was updated
      expect(mockQuery).toHaveBeenCalledWith('BEGIN', undefined);
      expect(mockQuery).toHaveBeenCalledWith('DROP TABLE users;', undefined);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE "public"."runway_migrations" SET rolled_back_at'), expect.arrayContaining(['002_users.sql']));
      expect(mockQuery).toHaveBeenCalledWith('COMMIT', undefined);

      // Update mock to reflect rolled back state
      mockQuery.mockImplementation((sql) => {
        if (sql.includes('SELECT name')) {
          return { rows: [
            { name: '001_init.sql', checksum: 'abc', applied_at: new Date('2026-03-30T10:00:00Z') },
            { name: '002_users.sql', checksum: 'def', applied_at: new Date('2026-03-30T11:00:00Z'), rolled_back_at: new Date('2026-03-30T12:00:00Z') }
          ]};
        }
        return { rows: [] };
      });

      // 2. Run status to verify it reads state correctly
      jest.spyOn(console, 'log');
      await status();
      
      const logCalls = console.log.mock.calls.map(call => call.join(' '));
      const hasPendingLog = logCalls.find(log => log.includes('Pending') && log.includes('1'));
      expect(hasPendingLog).toBeDefined();
    });
  });
});
