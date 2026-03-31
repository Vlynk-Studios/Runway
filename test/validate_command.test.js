import { jest } from '@jest/globals';

// --- Mocks ---

jest.unstable_mockModule('ora', () => ({
  default: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
  })),
}));

jest.unstable_mockModule('../src/config.js', () => ({
  config: { 
    database: { url: 'postgresql://localhost/test' },
    migrationsDir: './migrations'
  },
  validateDatabaseConfig: jest.fn(),
}));

jest.unstable_mockModule('../src/logger.js', () => ({
  logger: {
    printDivider: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }
}));

jest.unstable_mockModule('../src/core/adapter/postgres.js', () => ({
  PostgresAdapter: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(),
    end: jest.fn().mockResolvedValue(),
  }))
}));

jest.unstable_mockModule('../src/core/runner.js', () => {
  const mockValidate = jest.fn().mockResolvedValue([]);
  const mockRunner = jest.fn().mockImplementation(() => ({
    validate: mockValidate,
  }));
  mockRunner.prototype.validate = mockValidate;
  return { MigrationRunner: mockRunner };
});

// --- Imports ---
const { validate } = await import('../src/commands/validate.js');
const { logger } = await import('../src/logger.js');
const { MigrationRunner } = await import('../src/core/runner.js');

describe('validate command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('reports success when all migrations pass validation', async () => {
    const mockDetails = [
      { name: '001_initial.sql', checksum: 'abc', status: 'PASSED' },
      { name: '002_users.sql', checksum: 'def', status: 'PASSED' }
    ];
    
    MigrationRunner.prototype.validate.mockResolvedValue(mockDetails);

    await validate();

    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Integrity validation passed'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('001_initial.sql'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('002_users.sql'));
  });

  it('handles the case where no migrations have been applied', async () => {
    MigrationRunner.prototype.validate.mockResolvedValue([]);

    await validate();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('No migrations have been applied yet'));
  });

  it('handles validation failures by throwing or logging error', async () => {
    // Note: The command itself doesn't have a try-catch for runner.validate error, 
    // it relies on the caller or global handler, but it's good to test if it propagates.
    const error = new Error('Validation failed: Checksum mismatch');
    MigrationRunner.prototype.validate.mockRejectedValue(error);

    await expect(validate()).rejects.toThrow('Validation failed: Checksum mismatch');
  });
});
