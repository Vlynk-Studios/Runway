import { jest } from '@jest/globals';

// --- Mocks ---

jest.unstable_mockModule('mysql2/promise', () => {
  const mockQuery = jest.fn().mockResolvedValue([[], []]);
  const mockEnd = jest.fn().mockResolvedValue();
  
  const mockConnection = {
    query: mockQuery,
    end: mockEnd
  };

  const mockCreateConnection = jest.fn().mockResolvedValue(mockConnection);

  return {
    default: {
      createConnection: mockCreateConnection
    }
  };
});

// --- Imports ---

const mysql = (await import('mysql2/promise')).default;
const { MySQLAdapter } = await import('../src/core/adapter/mysql.js');

describe('MySQLAdapter', () => {
  const config = {
    database: {
      host: 'localhost',
      port: 3306,
      user: 'testuser',
      password: 'testpassword',
      database: 'testdb',
      ssl: false
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MySQLAdapter.instances.clear();
  });

  describe('connect', () => {
    it('successfully connects with structured credentials', async () => {
      const adapter = new MySQLAdapter(config);
      await adapter.connect();
      expect(mysql.createConnection).toHaveBeenCalledWith(expect.objectContaining({
        host: 'localhost',
        user: 'testuser',
        multipleStatements: true
      }));
    });

    it('successfully connects with DATABASE_URL', async () => {
      const urlConfig = { database: { url: 'mysql://user:pass@host/db' } };
      const adapter = new MySQLAdapter(urlConfig);
      await adapter.connect();
      expect(mysql.createConnection).toHaveBeenCalledWith(urlConfig.database.url);
    });

    it('classifies connection refused errors correctly', async () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      mysql.createConnection.mockRejectedValueOnce(error);

      const adapter = new MySQLAdapter(config);
      await expect(adapter.connect()).rejects.toThrow('Connection refused');
    });

    it('classifies authentication failures correctly', async () => {
      const error = new Error('Auth failed');
      error.code = 'ER_ACCESS_DENIED_ERROR';
      mysql.createConnection.mockRejectedValueOnce(error);

      const adapter = new MySQLAdapter(config);
      await expect(adapter.connect()).rejects.toThrow('Authentication failed');
    });

    it('classifies database not found errors correctly', async () => {
      const error = new Error('No DB');
      error.code = 'ER_BAD_DB_ERROR';
      mysql.createConnection.mockRejectedValueOnce(error);

      const adapter = new MySQLAdapter(config);
      await expect(adapter.connect()).rejects.toThrow('Database not found');
    });

    it('classifies timeout errors correctly', async () => {
      const error = new Error('Timeout');
      error.code = 'ETIMEDOUT';
      mysql.createConnection.mockRejectedValueOnce(error);

      const adapter = new MySQLAdapter(config);
      await expect(adapter.connect()).rejects.toThrow('Connection timed out');
    });
    
    it('classifies host not found errors correctly', async () => {
      const error = new Error('Not found');
      error.code = 'ENOTFOUND';
      mysql.createConnection.mockRejectedValueOnce(error);

      const adapter = new MySQLAdapter(config);
      await expect(adapter.connect()).rejects.toThrow('Host not found');
    });
  });

  describe('query and transactions', () => {
    it('executes a query after connecting and translates placeholders', async () => {
      const adapter = new MySQLAdapter(config);
      await adapter.connect();
      
      const mockResult = [[{ id: 1 }], []];
      const connection = await mysql.createConnection.mock.results[0].value;
      connection.query.mockResolvedValueOnce(mockResult);

      const result = await adapter.query('SELECT * FROM users WHERE id = $1', [1]);
      
      expect(connection.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1]);
      expect(result).toEqual({
        rows: [{ id: 1 }],
        fields: [],
        rowCount: 1
      });
    });

    it('handles non-array results (ResultSetHeader) for INSERT/UPDATE/DELETE', async () => {
      const adapter = new MySQLAdapter(config);
      await adapter.connect();
      
      const mockHeader = { affectedRows: 5 };
      const connection = await mysql.createConnection.mock.results[0].value;
      connection.query.mockResolvedValueOnce([mockHeader, undefined]);

      const result = await adapter.query('DELETE FROM users');
      
      expect(result).toEqual({
        rows: [mockHeader],
        fields: undefined,
        rowCount: 5
      });
    });

    it('throws error if query is called without connecting', async () => {
      const adapter = new MySQLAdapter(config);
      await expect(adapter.query('SELECT 1')).rejects.toThrow('Connection not established');
    });

    it('successfully executes transaction lifecycle commands', async () => {
      const adapter = new MySQLAdapter(config);
      await adapter.connect();
      const connection = await mysql.createConnection.mock.results[0].value;
      
      await adapter.begin();
      await adapter.commit();
      await adapter.rollback();
      
      expect(connection.query).toHaveBeenCalledWith('START TRANSACTION', undefined);
      expect(connection.query).toHaveBeenCalledWith('COMMIT', undefined);
      expect(connection.query).toHaveBeenCalledWith('ROLLBACK', undefined);
    });
  });

  describe('cleanup', () => {
    it('successfully closes the connection', async () => {
      const adapter = new MySQLAdapter(config);
      await adapter.connect();
      const connection = await mysql.createConnection.mock.results[0].value;
      
      await adapter.end();
      expect(connection.end).toHaveBeenCalled();
      expect(adapter.connection).toBeNull();
    });

    it('can close all active connections', async () => {
      const adapter1 = new MySQLAdapter(config);
      const adapter2 = new MySQLAdapter(config);
      await adapter1.connect();
      await adapter2.connect();
      
      const conn1 = await mysql.createConnection.mock.results[0].value;
      const conn2 = await mysql.createConnection.mock.results[1].value;
      
      await MySQLAdapter.closeAll();
      expect(conn1.end).toHaveBeenCalled();
      expect(conn2.end).toHaveBeenCalled();
    });
  });
});
