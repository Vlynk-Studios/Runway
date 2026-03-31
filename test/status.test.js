import { jest } from '@jest/globals';

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: jest.fn().mockReturnValue(true),
    readdirSync: jest.fn().mockReturnValue([]),
  }
}));

jest.unstable_mockModule('ora', () => ({
  default: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
  })),
}));

jest.unstable_mockModule('chalk', () => {
  const mockChalk = (s) => String(s);
  mockChalk.bold = Object.assign((s) => String(s), { red: (s) => String(s) });
  mockChalk.red = (s) => String(s);
  mockChalk.green = (s) => String(s);
  mockChalk.yellow = (s) => String(s);
  mockChalk.cyan = Object.assign((s) => String(s), { dim: (s) => String(s) });
  mockChalk.gray = (s) => String(s);
  mockChalk.dim = (s) => String(s);
  return { default: mockChalk };
});

jest.unstable_mockModule('../src/config.js', () => ({
  config: { migrationsDir: './migrations', schema: 'public' },
  validateDatabaseConfig: jest.fn(),
}));

jest.unstable_mockModule('../src/logger.js', () => ({
  logger: {
    printDivider: jest.fn(),
    suggest: jest.fn(),
    error: jest.fn(),
  }
}));

jest.unstable_mockModule('../src/core/adapter/postgres.js', () => ({
  PostgresAdapter: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(),
    end: jest.fn().mockResolvedValue(),
  }))
}));

jest.unstable_mockModule('../src/core/log-table.js', () => ({
  LogTable: jest.fn().mockImplementation(() => ({
    ensureTable: jest.fn().mockResolvedValue(),
    getAppliedMigrations: jest.fn().mockResolvedValue([]),
  }))
}));

const fs = (await import('fs')).default;
const { LogTable } = await import('../src/core/log-table.js');
const { status } = await import('../src/commands/status.js');

describe('status command logic', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('correctly identifies rolled-back migrations as pending if they exist on disk', async () => {
    fs.readdirSync.mockReturnValue(['001_initial.sql']);
    
    LogTable.mockImplementationOnce(() => ({
      ensureTable: jest.fn().mockResolvedValue(),
      getAppliedMigrations: jest.fn().mockResolvedValue([
        {
          name: '001_initial.sql',
          checksum: 'abc',
          applied_at: new Date('2026-03-30T10:00:00Z'),
          rolled_back_at: new Date('2026-03-30T11:00:00Z'),
        }
      ]),
    }));

    await status();

    const logCalls = logSpy.mock.calls.map(call => call.join(' '));
    const pendingLog = logCalls.find(log => log.includes('Pending     : 1'));
    const revertedLog = logCalls.find(log => log.includes('Rolled back : 1'));
    
    expect(pendingLog).toBeDefined();
    expect(revertedLog).toBeDefined();
  });

  it('correctly identifies orphan migrations', async () => {
    fs.readdirSync.mockReturnValue([]); 
    
    LogTable.mockImplementationOnce(() => ({
      ensureTable: jest.fn().mockResolvedValue(),
      getAppliedMigrations: jest.fn().mockResolvedValue([
        {
          name: '001_initial.sql',
          checksum: 'abc',
          applied_at: new Date('2026-03-30T10:00:00Z'),
          rolled_back_at: null,
        }
      ]),
    }));

    await status();

    const logCalls = logSpy.mock.calls.map(call => String(call[0] || ''));
    const hasOrphan = logCalls.some(log => log.includes('[ORPHAN ]') && log.includes('001_initial.sql'));
    // fix #3: orphans have their own summary line — not annotated inside Applied
    const hasOrphanSummary = logCalls.some(log => log.includes('[!]') && log.includes('Orphaned'));
    
    expect(hasOrphan).toBe(true);
    expect(hasOrphanSummary).toBe(true);
  });
  
  it('correctly identifies applied migrations', async () => {
    fs.readdirSync.mockReturnValue(['001_initial.sql']);
    
    LogTable.mockImplementationOnce(() => ({
      ensureTable: jest.fn().mockResolvedValue(),
      getAppliedMigrations: jest.fn().mockResolvedValue([
        {
          name: '001_initial.sql',
          checksum: 'abc',
          applied_at: new Date('2026-03-30T10:00:00Z'),
          rolled_back_at: null,
        }
      ]),
    }));

    await status();

    const logCalls = logSpy.mock.calls.map(call => call.join(' '));
    const appliedLogSummary = logCalls.find(log => log.includes('Applied     : 1'));
    const appliedRow = logCalls.find(log => log.includes('[APPLIED]') && log.includes('001_initial.sql'));
    
    expect(appliedLogSummary).toBeDefined();
    expect(appliedRow).toBeDefined();
  });
});
