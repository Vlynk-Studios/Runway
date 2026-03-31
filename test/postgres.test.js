import { jest } from '@jest/globals';

// --- Mocks ---

jest.unstable_mockModule('pg', () => {
  const mockConnect = jest.fn().mockResolvedValue();
  const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
  const mockEnd = jest.fn().mockResolvedValue();

  const mockClient = jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    query: mockQuery,
    end: mockEnd,
  }));

  mockClient.prototype.connect = mockConnect;
  mockClient.prototype.query = mockQuery;
  mockClient.prototype.end = mockEnd;

  return {
    default: {
      Client: mockClient
    }
  };
});

// --- Imports --- (Mocked Client is inside pg.default)
const pg = (await import('pg')).default;
const { PostgresAdapter } = await import('../src/core/adapter/postgres.js');

describe('PostgresAdapter', () => {
  const config = {
    database: {
      host: 'localhost',
      port: 5432,
      user: 'testuser',
      password: 'testpassword',
      database: 'testdb',
      ssl: false
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    PostgresAdapter.instances.clear();
  });

  describe('connect', () => {
    it('successfully connects with structured credentials', async () => {
      const adapter = new PostgresAdapter(config);
      await adapter.connect();
      expect(pg.Client).toHaveBeenCalledWith(expect.objectContaining({
        host: 'localhost',
        user: 'testuser'
      }));
    });

    it('successfully connects with DATABASE_URL', async () => {
      const urlConfig = { database: { url: 'postgresql://user:pass@host/db' } };
      const adapter = new PostgresAdapter(urlConfig);
      await adapter.connect();
      expect(pg.Client).toHaveBeenCalledWith({ connectionString: urlConfig.database.url });
    });

    it('classifies connection refused errors correctly', async () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      pg.Client.prototype.connect.mockRejectedValueOnce(error);

      const adapter = new PostgresAdapter(config);
      await expect(adapter.connect()).rejects.toThrow('Connection refused');
    });

    it('classifies authentication failures correctly', async () => {
      const error = new Error('Auth failed');
      error.code = '28P01';
      pg.Client.prototype.connect.mockRejectedValueOnce(error);

      const adapter = new PostgresAdapter(config);
      await expect(adapter.connect()).rejects.toThrow('Authentication failed');
    });

    it('classifies database not found errors correctly', async () => {
      const error = new Error('No DB');
      error.code = '3D000';
      pg.Client.prototype.connect.mockRejectedValueOnce(error);

      const adapter = new PostgresAdapter(config);
      await expect(adapter.connect()).rejects.toThrow('Database not found');
    });

    it('classifies SSL errors correctly', async () => {
      const error = new Error('The server does not support SSL connections');
      pg.Client.prototype.connect.mockRejectedValueOnce(error);

      const adapter = new PostgresAdapter(config);
      await expect(adapter.connect()).rejects.toThrow('SSL connection error');
    });
  });

  describe('query and transactions', () => {
    it('executes a query after connecting', async () => {
      const adapter = new PostgresAdapter(config);
      await adapter.connect();
      await adapter.query('SELECT 1');
      expect(pg.Client.prototype.query).toHaveBeenCalledWith('SELECT 1', undefined);
    });

    it('throws error if query is called without connecting', async () => {
      const adapter = new PostgresAdapter(config);
      await expect(adapter.query('SELECT 1')).rejects.toThrow('Client not connected');
    });

    it('successfully executes transaction lifecycle commands', async () => {
      const adapter = new PostgresAdapter(config);
      await adapter.connect();
      await adapter.begin();
      await adapter.commit();
      await adapter.rollback();
      
      expect(pg.Client.prototype.query).toHaveBeenCalledWith('BEGIN', undefined);
      expect(pg.Client.prototype.query).toHaveBeenCalledWith('COMMIT', undefined);
      expect(pg.Client.prototype.query).toHaveBeenCalledWith('ROLLBACK', undefined);
    });
  });

  describe('cleanup', () => {
    it('successfully closes the connection', async () => {
      const adapter = new PostgresAdapter(config);
      await adapter.connect();
      await adapter.end();
      expect(pg.Client.prototype.end).toHaveBeenCalled();
    });

    it('can close all active connections', async () => {
      const adapter1 = new PostgresAdapter(config);
      const adapter2 = new PostgresAdapter(config);
      await adapter1.connect();
      await adapter2.connect();
      
      await PostgresAdapter.closeAll();
      expect(pg.Client.prototype.end).toHaveBeenCalledTimes(2);
    });
  });
});
