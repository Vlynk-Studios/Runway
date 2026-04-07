import { getAdapter } from '../src/core/adapter/index.js';
import { PostgresAdapter } from '../src/core/adapter/postgres.js';
import { MySQLAdapter } from '../src/core/adapter/mysql.js';

describe('getAdapter Factory', () => {
  const baseConfig = {
    database: {
      host: 'localhost',
      port: 5432,
      user: 'test',
      password: 'test',
      database: 'test'
    }
  };

  it('returns a PostgresAdapter for dialect "postgres"', () => {
    const config = { ...baseConfig, dialect: 'postgres' };
    const adapter = getAdapter(config);
    expect(adapter).toBeInstanceOf(PostgresAdapter);
  });

  it('returns a MySQLAdapter for dialect "mysql"', () => {
    const config = { ...baseConfig, dialect: 'mysql' };
    const adapter = getAdapter(config);
    expect(adapter).toBeInstanceOf(MySQLAdapter);
  });

  it('returns a MySQLAdapter for dialect "mariadb"', () => {
    const config = { ...baseConfig, dialect: 'mariadb' };
    const adapter = getAdapter(config);
    expect(adapter).toBeInstanceOf(MySQLAdapter);
  });

  it('throws an error for an unknown dialect', () => {
    const config = { ...baseConfig, dialect: 'sqlite' };
    expect(() => getAdapter(config)).toThrow('Invalid dialect configured: "sqlite"');
  });
});
