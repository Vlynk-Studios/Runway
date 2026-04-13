import { PostgresAdapter } from './postgres.js';
import { MySQLAdapter } from './mysql.js';

/**
 * Factory function to instantiate the correct database adapter 
 * based on the configured dialect.
 */
export function getAdapter(config) {
  if (config.dialect === 'postgres') {
    return new PostgresAdapter(config);
  }
  if (config.dialect === 'mysql' || config.dialect === 'mariadb') {
    return new MySQLAdapter(config);
  }
  
  throw new Error(`Invalid dialect configured: "${config.dialect}". Valid options are: 'postgres', 'mysql', 'mariadb'.`);
}
