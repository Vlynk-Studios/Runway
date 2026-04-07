import { jest } from '@jest/globals';

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
});
