import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { config } from '../config.js';
import { logger } from '../logger.js';

/**
 * Creates a new migration file in the migrations directory.
 * Automatically calculates the next sequence number (e.g., 001, 002).
 * 
 * @param {string} name - Desired name for the migration.
 */
export async function create(name) {
  if (!name) {
    logger.error('Migration name is required.');
    logger.info('Usage: runway create <name>');
    process.exit(1);
  }

  const migrationsDir = path.resolve(process.cwd(), config.migrationsDir);

  // 1. Ensure the migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    logger.error(`Migrations directory not found: ${config.migrationsDir}`);
    logger.suggest('runway init');
    process.exit(1);
  }

  // 2. Scan directory to determine the next number
  let nextNumber = 1;
  try {
    const files = fs.readdirSync(migrationsDir);
    const existingNumbers = files
      .filter(file => /^\d+_.*\.sql$/.test(file))
      .map(file => parseInt(file.split('_')[0], 10));

    if (existingNumbers.length > 0) {
      nextNumber = Math.max(...existingNumbers) + 1;
    }
  } catch (error) {
    logger.error(`Error reading migrations directory: ${error.message}`);
    process.exit(1);
  }

  // 3. Format filename (NNN_name.sql)
  const prefix = String(nextNumber).padStart(3, '0');
  const sanitizedName = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Spaces to hyphens
    .replace(/[^a-z0-9-]/g, '');    // Remove special characters (except hyphens)
  
  const upFileName = `${prefix}_${sanitizedName}.sql`;
  const downFileName = `${prefix}_${sanitizedName}.down.sql`;
  
  const upFilePath = path.join(migrationsDir, upFileName);
  const downFilePath = path.join(migrationsDir, downFileName);
  
  // (Omitted: SQL templates generation logic remains the same)
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const upContent = `-- Migration: ${name} (UP)\n-- Created: ${timestamp}\n\n-- Write your UP migration SQL here\n`;
  const downContent = `-- Migration: ${name} (DOWN)\n-- Created: ${timestamp}\n\n-- Write your DOWN migration SQL here\n`;

  // 5. Write files and log result
  try {
    fs.writeFileSync(upFilePath, upContent, 'utf8');
    fs.writeFileSync(downFilePath, downContent, 'utf8');
    
    // Requested format: ✔ Migration creada — migrations/003_add-roles-table.sql
    const relativePath = path.join(config.migrationsDir, upFileName).replace(/\\/g, '/');
    logger.success(`Migration creada — ${chalk.bold(relativePath)}`);
    
    logger.suggest('runway up');
  } catch (error) {
    logger.error(`Could not write migration files: ${error.message}`);
    process.exit(1);
  }
}
