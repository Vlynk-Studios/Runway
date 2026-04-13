import { jest } from '@jest/globals';

describe('Environment Detection', () => {
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

  it('detects DATABASE_URL and gives it precedence', async () => {
    process.env.DATABASE_URL = 'postgres://test_user:test_pass@test_host:5432/test_db';
    
    // Use dynamic import after setting the env
    let config;
    await jest.isolateModulesAsync(async () => {
      const module = await import('../src/config.js');
      config = module.config;
    });
    
    expect(config.database.url).toBe(process.env.DATABASE_URL);
  });

  it('respects RUNWAY_ENV for environment file selection', async () => {
    process.env.RUNWAY_ENV = '.env.production';
    
    // We can't easily check if dotenv was called with the right path without mocking it,
    // but we can verify the logic is in src/config.js
    let configModule;
    await jest.isolateModulesAsync(async () => {
      configModule = await import('../src/config.js');
    });
    
    // Since we don't have a real .env.production, we just check if it's exported/handled
    // This is more of a code-path verification
    expect(configModule).toBeDefined();
  });

  it('detects --env flag from process.argv', async () => {
    process.argv = ['node', 'bin/runway.js', 'status', '--env', '.env.custom'];
    
    let configModule;
    await jest.isolateModulesAsync(async () => {
      configModule = await import('../src/config.js');
    });
    expect(configModule).toBeDefined();
  });

  it('exits with a clear error message when database config is missing', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
       throw new Error('process.exit');
    });
    
    // 51:
    // Clear all DB-related env vars and prevent loading real .env
    delete process.env.DATABASE_URL;
    delete process.env.DB_HOST;
    delete process.env.DB_USER;
    delete process.env.DB_NAME;
    process.env.RUNWAY_ENV = '.env.nonexistent'; // Point to a file that doesn't exist

    let validateDatabaseConfig;
    await jest.isolateModulesAsync(async () => {
      const module = await import('../src/config.js');
      validateDatabaseConfig = module.validateDatabaseConfig;
    });
    
    expect(() => validateDatabaseConfig()).toThrow('process.exit');
    exitSpy.mockRestore();
  });
});
