import { jest } from '@jest/globals';

jest.unstable_mockModule('chalk', () => ({
  default: { yellow: s => s, red: s => s, green: s => s, blue: s => s, gray: s => s }
}));

describe('Configuration Logic', () => {
  const originalEnv = process.env;
  const originalArgv = process.argv;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.argv = [...originalArgv];
  });

  afterAll(() => {
    process.env = originalEnv;
    process.argv = originalArgv;
  });

  async function loadConfig() {
    let module;
    await jest.isolateModulesAsync(async () => {
      module = await import('../src/config.js');
    });
    return module;
  }

  it('sets default port to 5432 for postgres', async () => {
    process.env.RUNWAY_DIALECT = 'postgres';
    const { config } = await loadConfig();
    expect(config.dialect).toBe('postgres');
    expect(config.database.port).toBe(5432);
  });

  it('sets default port to 3306 for mysql', async () => {
    process.env.RUNWAY_DIALECT = 'mysql';
    const { config } = await loadConfig();
    expect(config.dialect).toBe('mysql');
    expect(config.database.port).toBe(3306);
  });

  it('validates a correct mysql:// url when dialect is mysql', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    process.env.RUNWAY_DIALECT = 'mysql';
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/db';
    
    const { validateDatabaseConfig } = await loadConfig();
    expect(() => validateDatabaseConfig()).not.toThrow();
    exitSpy.mockRestore();
  });

  it('fails validation for a postgresql:// url when dialect is mysql', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Optional: suppress console output
    process.env.RUNWAY_DIALECT = 'mysql';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    
    const { validateDatabaseConfig } = await loadConfig();
    expect(() => validateDatabaseConfig()).toThrow('exit');
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('fails validation for a mysql:// url when dialect is postgres', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    process.env.RUNWAY_DIALECT = 'postgres';
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/db';
    
    const { validateDatabaseConfig } = await loadConfig();
    expect(() => validateDatabaseConfig()).toThrow('exit');
    exitSpy.mockRestore();
  });

  it('catches and logs error when config file import fails', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const badConfigPath = path.resolve(process.cwd(), 'runway.config.js');
    fs.writeFileSync(badConfigPath, 'throw new Error("runtime config error");');
    
    const warnSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await loadConfig();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not load runway.config.js'));
    
    fs.unlinkSync(badConfigPath);
    warnSpy.mockRestore();
  });

  it('loads custom env file specified in config', async () => {
    delete process.env.RUNWAY_ENV;
    process.argv = []; // remove --env
    const fs = await import('fs');
    const path = await import('path');
    const configPath = path.resolve(process.cwd(), 'runway.config.js');
    fs.writeFileSync(configPath, 'export default { envFile: ".env.custom" };');
    
    const envPath = path.resolve(process.cwd(), '.env.custom');
    fs.writeFileSync(envPath, 'DB_HOST=custom_host');

    const { config } = await loadConfig();
    expect(config.database.host).toBe('custom_host');

    fs.unlinkSync(configPath);
    fs.unlinkSync(envPath);
  });
});
