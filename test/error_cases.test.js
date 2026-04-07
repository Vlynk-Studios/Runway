import { jest } from '@jest/globals';

// --- Mocks ---

// Mock fs with both default and named exports
jest.unstable_mockModule('fs', () => {
    const mockFs = {
        existsSync: jest.fn().mockReturnValue(true),
        readdirSync: jest.fn().mockReturnValue([]),
        readFileSync: jest.fn().mockReturnValue(''),
        writeFileSync: jest.fn(),
    };
    return {
        ...mockFs,
        default: mockFs
    };
});

jest.unstable_mockModule('ora', () => ({
  default: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    text: '',
  })),
}));

jest.unstable_mockModule('../src/config.js', () => ({
  config: {
    migrationsDir: './migrations',
    schema: 'public',
    dialect: 'postgres',
    database: { url: 'postgresql://localhost/test' },
  },
  validateDatabaseConfig: jest.fn(),
}));

jest.unstable_mockModule('../src/logger.js', () => ({
  logger: {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    suggest: jest.fn(),
    printDivider: jest.fn(),
  }
}));

const mockAdapter = {
  connect: jest.fn().mockResolvedValue(),
  query: jest.fn().mockResolvedValue({ rows: [] }),
  begin: jest.fn().mockResolvedValue(),
  commit: jest.fn().mockResolvedValue(),
  rollback: jest.fn().mockResolvedValue(),
  end: jest.fn().mockResolvedValue(),
};

jest.unstable_mockModule('../src/core/adapter/index.js', () => ({
  getAdapter: jest.fn().mockReturnValue(mockAdapter),
}));

// --- Imports ---

const fs = (await import('fs')).default;
const { baseline } = await import('../src/commands/baseline.js');
const { migrate } = await import('../src/commands/migrate.js');
const { rollback } = await import('../src/commands/rollback.js');
const { status } = await import('../src/commands/status.js');
const { logger } = await import('../src/logger.js');

describe('Command Error Cases and Edge Cases', () => {
    let exitSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });

        // Reset mockAdapter to default resolved state — clearAllMocks() does NOT reset
        // implementations, so a rejected mock from a previous test would leak here.
        mockAdapter.connect.mockResolvedValue();
        mockAdapter.query.mockResolvedValue({ rows: [] });
        mockAdapter.begin.mockResolvedValue();
        mockAdapter.commit.mockResolvedValue();
        mockAdapter.rollback.mockResolvedValue();
        mockAdapter.end.mockResolvedValue();

        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue([]);

        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        exitSpy.mockRestore();
        jest.restoreAllMocks();
    });

    describe('baseline', () => {
        it('throws error if migrations directory is missing', async () => {
            fs.existsSync.mockImplementation((p) => !p.includes('migrations'));
            await expect(baseline()).rejects.toThrow('exit');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Migrations directory not found'));
        });

        it('logs info if no migrations are pending for baseline', async () => {
            fs.readdirSync.mockReturnValue([]);
            await baseline();
            expect(logger.info).toHaveBeenCalledWith('No new migrations to baseline.');
        });
    });

    describe('migrate', () => {
        it('handles connection error gracefully', async () => {
            mockAdapter.connect.mockRejectedValue(new Error('Connect error'));
            await expect(migrate({})).rejects.toThrow('exit');
            expect(logger.error).toHaveBeenCalledWith('Connect error');
        });

        it('logs info if no migrations found and not dry-run', async () => {
            fs.readdirSync.mockReturnValue([]);
            mockAdapter.query.mockResolvedValue({ rows: [] });
            try {
                await migrate({});
            } catch (e) {
                if (e.message === 'exit') {
                    console.log('ACTUAL ERROR:', logger.error.mock.calls);
                }
                throw e;
            }
            expect(logger.info).toHaveBeenCalledWith('No pending migrations found.');
        });
    });

    describe('rollback', () => {
        it('handles database error during rollback', async () => {
            mockAdapter.connect.mockRejectedValue(new Error('DB error'));
            await expect(rollback({})).rejects.toThrow('exit');
            expect(logger.error).toHaveBeenCalledWith('DB error');
        });
    });

    describe('status', () => {
        it('handles database error during status check', async () => {
            mockAdapter.connect.mockRejectedValue(new Error('Status error'));
            await expect(status({})).rejects.toThrow('exit');
            expect(logger.error).toHaveBeenCalledWith('Status error');
        });
    });
});
