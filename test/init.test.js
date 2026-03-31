import { jest } from '@jest/globals';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
  }
}));

jest.unstable_mockModule('inquirer', () => ({
  default: {
    prompt: jest.fn(),
  }
}));

jest.unstable_mockModule('../src/logger.js', () => ({
  logger: {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    suggest: jest.fn(),
    printHeader: jest.fn(),
    printDivider: jest.fn(),
  }
}));

// Import after mocks
const fs = (await import('fs')).default;
const inquirer = (await import('inquirer')).default;
const { logger } = await import('../src/logger.js');
const { init } = await import('../src/commands/init.js');

describe('init command', () => {
  const mockCwd = '/fake/project';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'cwd').mockReturnValue(mockCwd);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    
    // Default: Template exists, but target files don't
    fs.existsSync.mockImplementation((p) => {
        if (p.includes('templates')) return true;
        return false;
    });
    fs.readFileSync.mockReturnValue('// url: process.env.DATABASE_URL');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('performs a complete fresh initialization', async () => {
    inquirer.prompt.mockResolvedValue({
      hasDatabase: true,
      setupEnv: true,
      dbHost: 'localhost',
      dbPort: '5432',
      dbUser: 'user',
      dbPass: 'pass',
      dbName: 'db'
    });

    await init();

    // Check directory creation
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('migrations'), { recursive: true });
    
    // Check config file creation
    expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('runway.config.js'), 
        expect.stringContaining('url: process.env.DATABASE_URL')
    );
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.env'), 
        expect.stringContaining('DATABASE_URL="postgresql://user:pass@localhost:5432/db"')
    );
    
    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Runway initialization complete'));
  });

  it('skips creating directory and config if they already exist', async () => {
    fs.existsSync.mockReturnValue(true);
    inquirer.prompt.mockResolvedValue({
      hasDatabase: true,
      setupEnv: false
    });

    await init();

    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('already exists'));
  });

  it('appends DATABASE_URL to existing .env if missing', async () => {
    fs.existsSync.mockImplementation((p) => {
        if (p.includes('templates')) return true;
        if (p.endsWith('.env')) return true;
        return true; // Already exists
    });
    fs.readFileSync.mockImplementation((p) => {
        if (p.endsWith('.env')) return 'EXISTING_VAR=123';
        return '// url: process.env.DATABASE_URL';
    });
    
    inquirer.prompt.mockResolvedValue({
      hasDatabase: true,
      setupEnv: true,
      dbHost: 'localhost',
      dbPort: '5432',
      dbUser: 'user',
      dbPass: 'pass',
      dbName: 'db'
    });

    await init();

    expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.env'), 
        expect.stringContaining('DATABASE_URL="postgresql://user:pass@localhost:5432/db"')
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.env'), 
        expect.stringContaining('EXISTING_VAR=123')
    );
  });

  it('handles filesystem errors gracefully during directory creation', async () => {
    fs.existsSync.mockImplementation((p) => p.includes('templates'));
    fs.mkdirSync.mockImplementation(() => { throw new Error('Permission denied'); });
    
    inquirer.prompt.mockResolvedValue({ hasDatabase: false });

    await init();

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Could not create migrations directory'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Initialization partially failed'));
  });

  it('handles template missing error', async () => {
    fs.existsSync.mockReturnValue(false); 

    inquirer.prompt.mockResolvedValue({ hasDatabase: false });

    await init();

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Could not generate runway.config.js'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Template not found'));
  });

  it('skips database setup prompts if DATABASE_URL is already present in .env', async () => {
    fs.existsSync.mockImplementation((p) => {
        if (p.includes('templates')) return true;
        if (p.endsWith('.env')) return true;
        if (p.endsWith('runway.config.js')) return false;
        return true; 
    });
    fs.readFileSync.mockImplementation((p) => {
        if (p.endsWith('.env')) return 'DATABASE_URL="old-url"';
        return '// url: process.env.DATABASE_URL';
    });
    
    // Inquirer should be called but skip all questions (returning empty answers or default)
    inquirer.prompt.mockResolvedValue({});

    await init();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL detected in .env — skipping setup'));
    // Should NOT have tried to write to .env
    expect(fs.writeFileSync).not.toHaveBeenCalledWith(expect.stringContaining('.env'), expect.any(String));
    // Should still have uncommented the config
    expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('runway.config.js'), 
        expect.stringContaining('url: process.env.DATABASE_URL')
    );
  });

  it('skips database setup prompts if separate keys are present in .env', async () => {
    fs.existsSync.mockImplementation((p) => {
        if (p.includes('templates')) return true;
        if (p.endsWith('.env')) return true;
        return true; 
    });
    fs.readFileSync.mockImplementation((p) => {
        if (p.endsWith('.env')) return 'DB_HOST=localhost\nDB_USER=postgres\nDB_NAME=db\nDB_PASSWORD=pass';
        return '// url: process.env.DATABASE_URL';
    });
    
    // Inquirer should be called but skip all questions
    inquirer.prompt.mockResolvedValue({});

    await init();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Database credentials detected in .env — skipping setup'));
    // Should NOT have tried to write to .env
    expect(fs.writeFileSync).not.toHaveBeenCalledWith(expect.stringContaining('.env'), expect.any(String));
  });

  it('suggests baseline if user has database', async () => {
    inquirer.prompt.mockResolvedValue({ hasDatabase: true, setupEnv: false });
    fs.existsSync.mockReturnValue(true);
    await init();
    expect(logger.suggest).toHaveBeenCalledWith(expect.stringContaining('runway baseline'));
  });

  it('suggests create if user has no database', async () => {
    inquirer.prompt.mockResolvedValue({ hasDatabase: false });
    fs.existsSync.mockReturnValue(true);
    await init();
    expect(logger.suggest).toHaveBeenCalledWith(expect.stringContaining('runway create'));
  });

  it('encodes special characters in password correctly', async () => {
    inquirer.prompt.mockResolvedValue({
      hasDatabase: true,
      setupEnv: true,
      dbHost: 'localhost',
      dbPort: '5432',
      dbUser: 'user',
      dbPass: 'p@ss#word!',
      dbName: 'db'
    });

    await init();

    expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.env'), 
        expect.stringContaining('DATABASE_URL="postgresql://user:p%40ss%23word!@localhost:5432/db"')
    );
  });

  it('handles errors when writing to .env', async () => {
    fs.existsSync.mockImplementation((p) => {
        if (p.includes('templates')) return true;
        if (p.endsWith('.env')) return false; // Try to create new
        return true; 
    });
    fs.writeFileSync.mockImplementation((p) => {
        if (p.endsWith('.env')) throw new Error('Crashed');
    });

    inquirer.prompt.mockResolvedValue({
      hasDatabase: true,
      setupEnv: true,
      dbHost: 'localhost',
      dbPort: '5432',
      dbUser: 'user',
      dbPass: 'pass',
      dbName: 'db'
    });

    await init();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to update .env: Crashed'));
  });
});
