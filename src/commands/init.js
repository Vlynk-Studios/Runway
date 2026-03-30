import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
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

  // Source template paths (relative to this script)
  const configTemplate = path.resolve(__dirname, '../templates/runway.config.js');

  // 1. Interactive Prompt
  await inquirer.prompt([
    {
      type: 'list',
      name: 'projectType',
      message: 'Is this a new project or an existing database?',
      choices: [
        { name: 'New project', value: 'new' },
        { name: 'Existing database', value: 'existing' }
      ]
    }
  ]);

  // 2. Create migrations directory
  let migrationsDirReady = true;
  if (!fs.existsSync(migrationsDir)) {
    try {
      fs.mkdirSync(migrationsDir, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create migrations directory: ${error.message}`);
      migrationsDirReady = false;
    }
  }

  // 3. Generate runway.config.js
  let configFileReady = true;
  if (!fs.existsSync(configFile)) {
    try {
      const content = fs.readFileSync(configTemplate, 'utf-8');
      fs.writeFileSync(configFile, content);
    } catch (error) {
      logger.error(`Failed to generate runway.config.js: ${error.message}`);
      configFileReady = false;
    }
  }

  // 4. Final Logs
  if (configFileReady) {
    logger.success('runway.config.js created');
  }

  if (migrationsDirReady) {
    logger.success('migrations/ directory ready');
  }

  logger.suggest('runway create create-users-table');
}
