import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initializes a new Runway project by creating the migrations directory
 * and generating configuration files from templates.
 */
export async function init() {
  const cwd = process.cwd();
  
  // Target paths in the current project
  const migrationsDir = path.join(cwd, 'migrations');
  const configFile = path.join(cwd, 'runway.config.js');
  const envExampleFile = path.join(cwd, '.env.example');

  // Source template paths (relative to this script)
  const configTemplate = path.resolve(__dirname, '../templates/runway.config.js');
  const envTemplate = path.resolve(__dirname, '../../.env.example');

  logger.info('Initializing Runway project...');

  // 1. Create migrations directory
  if (!fs.existsSync(migrationsDir)) {
    try {
      fs.mkdirSync(migrationsDir, { recursive: true });
      logger.success('Created directory: ./migrations/');
    } catch (error) {
      logger.error(`Failed to create migrations directory: ${error.message}`);
    }
  } else {
    logger.warn('Directory ./migrations/ already exists. Skipping...');
  }

  // 2. Generate runway.config.js
  if (!fs.existsSync(configFile)) {
    try {
      const content = fs.readFileSync(configTemplate, 'utf-8');
      fs.writeFileSync(configFile, content);
      logger.success('Generated file: runway.config.js');
    } catch (error) {
      logger.error(`Failed to generate runway.config.js: ${error.message}`);
    }
  } else {
    logger.warn('File runway.config.js already exists. Skipping...');
  }

  // 3. Generate .env.example
  if (!fs.existsSync(envExampleFile)) {
    try {
      // Use the project's root .env.example as the source template
      const content = fs.readFileSync(envTemplate, 'utf-8');
      fs.writeFileSync(envExampleFile, content);
      logger.success('Generated file: .env.example');
    } catch (error) {
      logger.error(`Failed to generate .env.example: ${error.message}`);
    }
  } else {
    logger.warn('File .env.example already exists. Skipping...');
  }

  logger.printDivider();
  logger.success('Runway initialization complete!');
  logger.info('Next steps:');
  logger.info('  1. Configure your database in runway.config.js or .env');
  logger.info('  2. Create your first migration: npx runway create <name>');
  console.log('\n');
}
