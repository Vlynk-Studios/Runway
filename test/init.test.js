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
      dbUrl: 'postgres://user:pass@localhost:5432/db'
    });

    await init();

    // Check directory creation
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('migrations'), { recursive: true });
    
    // Check config file creation
    expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('runway.config.js'), 
        expect.stringContaining('url: process.env.DATABASE_URL')
    );
    
    // Check .env file creation
    expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.env'), 
        expect.stringContaining('DATABASE_URL="postgres://user:pass@localhost:5432/db"')
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
      dbUrl: 'postgres://localhost/db'
    });

    await init();

    expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.env'), 
        expect.stringContaining('DATABASE_URL="postgres://localhost/db"')
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

  it('does not overwrite DATABASE_URL if already present in .env', async () => {
    fs.existsSync.mockImplementation((p) => {
        if (p.includes('templates')) return true;
        if (p.endsWith('.env')) return true;
        return true; 
    });
    fs.readFileSync.mockImplementation((p) => {
        if (p.endsWith('.env')) return 'DATABASE_URL="old-url"';
        return '// url: process.env.DATABASE_URL';
    });
    
    inquirer.prompt.mockResolvedValue({
      hasDatabase: true,
      setupEnv: true,
      dbUrl: 'postgres://new-url'
    });

    await init();

    // The only call should be for runway.config.js if it doesn't exist, 
    // but in this test setup runway.config.js is returned as existing by existsSync(true)
    expect(fs.writeFileSync).not.toHaveBeenCalledWith(expect.stringContaining('.env'), expect.any(String));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('already exists in .env'));
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

  it('validates database URL correctly', async () => {
    // We need to call the validate function inside the inquirer prompt call
    inquirer.prompt.mockResolvedValue({ hasDatabase: true, setupEnv: true, dbUrl: 'postgres://valid' });
    await init();
    
    const promptCalls = inquirer.prompt.mock.calls[0][0];
    const urlPrompt = promptCalls.find(p => p.name === 'dbUrl');
    
    expect(urlPrompt.validate('')).toBe('Database URL cannot be empty.');
    expect(urlPrompt.validate('invalid-url')).toBe('URL must start with postgres:// or postgresql://');
    expect(urlPrompt.validate('postgres://valid')).toBe(true);
    expect(urlPrompt.validate('postgresql://valid')).toBe(true);
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
      dbUrl: 'postgres://localhost/db'
    });

    await init();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to update .env: Crashed'));
  });
});
