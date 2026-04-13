import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs';

// Mocking ESM modules before importing them
jest.unstable_mockModule('inquirer', () => ({
  default: {
    prompt: jest.fn(),
  },
}));

jest.unstable_mockModule('mysql2/promise', () => {
  const mockQuery = jest.fn().mockResolvedValue([[], []]);
  const mockEnd = jest.fn().mockResolvedValue(undefined);
  const mockConnection = {
    query: mockQuery,
    end: mockEnd,
  };
  const createConnection = jest.fn().mockResolvedValue(mockConnection);
  return {
    default: { createConnection },
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
// FORCING DIALECT: 'mariadb'
jest.unstable_mockModule('../src/config.js', () => ({
  config: {
    migrationsDir: './migrations',
    schema: 'public', // In MariaDB this will be ignored
    dialect: 'mariadb',
    database: {
      url: 'mariadb://user:pass@localhost:3306/db',
    },
  },
  validateDatabaseConfig: jest.fn(),
}));

// Import commands after mocks
const { init } = await import('../src/commands/init.js');
const { migrate } = await import('../src/commands/migrate.js');
const { rollback } = await import('../src/commands/rollback.js');
const { logger } = await import('../src/logger.js');
const mysql = (await import('mysql2/promise')).default;
const inquirer = (await import('inquirer')).default;

describe('End-to-End Flows (MariaDB Support)', () => {
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
    jest.spyOn(fs, 'readFileSync').mockReturnValue("dialect: 'mariadb'\n// url: process.env.DATABASE_URL");
    jest.spyOn(fs, 'readdirSync').mockReturnValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Flow 1: New Project (Zero to Hero) for MariaDB', () => {
    it('initializes a new project with MariaDB config', async () => {
      inquirer.prompt.mockResolvedValueOnce({
        dialect: 'mariadb',
        hasDatabase: false,
        setupEnv: false
      });

      await init();

      expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(mockCwd, 'migrations'), { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith(path.join(mockCwd, 'runway.config.js'), expect.stringContaining("dialect: 'mariadb'"));
      expect(logger.suggest).toHaveBeenCalledWith(expect.stringContaining('runway create create-users-table'));
    });

    it('runs migrations (migrate) with MariaDB syntax', async () => {
      fs.readdirSync.mockReturnValue(['001_init.sql']);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((p) => {
        if (p.endsWith('001_init.sql')) return 'CREATE TABLE init (id INT AUTO_INCREMENT PRIMARY KEY);';
        return '';
      });

      const mockQuery = jest.fn().mockImplementation((sql) => {
        if (sql.includes('SELECT name FROM `runway_migrations`')) return [[], []];
        if (sql.includes('FROM information_schema.columns')) return [[], []];
        return [[], []];
      });
      const mockConn = {
        query: mockQuery,
        end: jest.fn().mockResolvedValue(undefined),
      };
      mysql.createConnection.mockResolvedValue(mockConn);

      await migrate();

      expect(mockQuery).toHaveBeenCalledWith('START TRANSACTION', undefined);
      expect(mockQuery).toHaveBeenCalledWith('CREATE TABLE init (id INT AUTO_INCREMENT PRIMARY KEY);', undefined);
      // Verify placeholder translation ($1 -> ?)
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO `runway_migrations`'), expect.arrayContaining(['001_init.sql']));
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ON DUPLICATE KEY UPDATE'), expect.any(Array));
      expect(mockQuery).toHaveBeenCalledWith('COMMIT', undefined);
    });
  });

  describe('Flow 3: Rollback for MariaDB', () => {
    it('rolls back migrations in MariaDB', async () => {
       fs.readdirSync.mockReturnValue(['001_init.sql']);
       fs.existsSync.mockReturnValue(true);
       fs.readFileSync.mockImplementation((p) => {
         if (p.endsWith('001_init.down.sql')) return 'DROP TABLE init;';
         return '';
       });

       const mockQuery = jest.fn().mockImplementation((sql) => {
         if (sql.includes('SELECT name')) {
           return [[{ name: '001_init.sql', checksum: 'abc', applied_at: new Date() }], []];
         }
         return [[], []];
       });
       const mockConn = {
         query: mockQuery,
         end: jest.fn().mockResolvedValue(undefined),
       };
       mysql.createConnection.mockResolvedValue(mockConn);

       inquirer.prompt.mockResolvedValueOnce({ confirm: true });
       
       await rollback({ steps: 1, yes: true });

       expect(mockQuery).toHaveBeenCalledWith('START TRANSACTION', undefined);
       expect(mockQuery).toHaveBeenCalledWith('DROP TABLE init;', undefined);
       expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE `runway_migrations` SET rolled_back_at'), expect.arrayContaining(['001_init.sql']));
       expect(mockQuery).toHaveBeenCalledWith('COMMIT', undefined);
    });
  });
});
