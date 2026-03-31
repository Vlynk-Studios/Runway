import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import chalk from 'chalk';
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

  // Source template paths (relative to this script) - ensured resilience
  const configTemplate = path.resolve(__dirname, '../templates/runway.config.js');

  console.log(chalk.bold("Welcome to Runway! Let's get your project staged.\n"));

  // 1. Detect existing configuration (Broad detection)
  const envFile = path.join(cwd, '.env');
  let hasExistingDbConfig = false;
  if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf-8');
    const hasUrl = envContent.includes('DATABASE_URL=');
    const hasKeys = ['DB_HOST=', 'DB_USER=', 'DB_NAME=', 'DB_PASSWORD='].every(key => envContent.includes(key));
    
    if (hasUrl || hasKeys) {
      hasExistingDbConfig = true;
      const type = hasUrl ? 'DATABASE_URL' : 'Database credentials';
      logger.info(`${type} detected in .env — skipping setup`);
    }
  }

  // 1. Interactive Prompt
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'hasDatabase',
      message: 'Do you already have a database?',
      default: true,
      when: () => !hasExistingDbConfig
    },
    {
      type: 'confirm',
      name: 'setupEnv',
      message: 'Do you want to set up your database connection now? (Creates/updates .env file)',
      default: true,
      when: (answers) => !hasExistingDbConfig && answers.hasDatabase
    },
    {
      type: 'input',
      name: 'dbHost',
      message: 'Database Host:',
      default: 'localhost',
      when: (answers) => !hasExistingDbConfig && answers.setupEnv
    },
    {
      type: 'input',
      name: 'dbPort',
      message: 'Database Port:',
      default: '5432',
      when: (answers) => !hasExistingDbConfig && answers.setupEnv
    },
    {
      type: 'input',
      name: 'dbUser',
      message: 'Database User:',
      default: 'postgres',
      when: (answers) => !hasExistingDbConfig && answers.setupEnv
    },
    {
      type: 'password',
      name: 'dbPass',
      message: 'Database Password:',
      mask: '*',
      when: (answers) => !hasExistingDbConfig && answers.setupEnv
    },
    {
      type: 'input',
      name: 'dbName',
      message: 'Database Name:',
      default: 'postgres',
      when: (answers) => !hasExistingDbConfig && answers.setupEnv
    }
  ]);

  // If we collected individual parts, construct the final URL
  if (!hasExistingDbConfig && answers.setupEnv) {
    const encodedPass = encodeURIComponent(answers.dbPass || '');
    // Construct valid URI for PostgreSQL
    answers.dbUrl = `postgresql://${answers.dbUser}:${encodedPass}@${answers.dbHost}:${answers.dbPort}/${answers.dbName}`;
  }

  // Normalize answers if skipped
  if (hasExistingDbConfig) {
    answers.hasDatabase = true;
  }

  // 2. Create migrations directory
  let migrationsDirReady = true;
  if (!fs.existsSync(migrationsDir)) {
    try {
      fs.mkdirSync(migrationsDir, { recursive: true });
    } catch (error) {
      logger.error(`Critical: Could not create migrations directory at ${migrationsDir}`);
      logger.error(`Reason: ${error.message}`);
      migrationsDirReady = false;
    }
  } else {
    logger.info('migrations/ directory already exists. Skipping creation.');
  }

  // 3. Generate runway.config.js
  let configFileReady = true;
  if (!fs.existsSync(configFile)) {
    try {
      if (!fs.existsSync(configTemplate)) {
         throw new Error(`Template not found at ${configTemplate}`);
      }

      let content = fs.readFileSync(configTemplate, 'utf-8');
      
      // If we got the URL (either detected or prompted), let's make sure it's uncommented in the config.
      if (hasExistingDbConfig || (answers.setupEnv && answers.dbUrl)) {
         content = content.replace(/\/\/\s*url:\s*process\.env\.DATABASE_URL/, 'url: process.env.DATABASE_URL');
      }

      fs.writeFileSync(configFile, content);
    } catch (error) {
      logger.error(`Critical: Could not generate runway.config.js`);
      logger.error(`Reason: ${error.message}`);
      configFileReady = false;
    }
  } else {
    logger.info('runway.config.js already exists. Skipping generation.');
  }

  // 4. Handle `.env` file setup
  if (answers.setupEnv && answers.dbUrl) {
    const envFile = path.join(cwd, '.env');
    try {
      if (fs.existsSync(envFile)) {
        let envContent = fs.readFileSync(envFile, 'utf-8');
        
        if (!envContent.includes('DATABASE_URL=')) {
          const separator = envContent.length > 0 && !envContent.endsWith('\n') ? '\n' : '';
          envContent += `${separator}DATABASE_URL="${answers.dbUrl.trim()}"\n`;
          fs.writeFileSync(envFile, envContent);
          logger.success('Added DATABASE_URL to your existing .env file');
        } else {
          logger.warn('DATABASE_URL already exists in .env. We did not overwrite it.');
        }
      } else {
        const envContent = `DATABASE_URL="${answers.dbUrl.trim()}"\n`;
        fs.writeFileSync(envFile, envContent);
        logger.success('.env file created with your database URL');
      }
    } catch (error) {
      logger.error(`Failed to update .env: ${error.message}`);
    }
  }

  // 5. Final Status
  console.log('');
  logger.printDivider();
  
  if (configFileReady && migrationsDirReady) {
    logger.success('Runway initialization complete!');
    
    if (configFileReady) logger.success(' - runway.config.js (initialized)');
    if (migrationsDirReady) logger.success(' - migrations/ (created)');
    
    if (answers.hasDatabase) {
      logger.suggest('Since you have an existing DB, consider running: runway baseline');
    } else {
      logger.suggest('To create your first migration run: runway create create-users-table');
    }
  } else {
    logger.error('Initialization partially failed. Please check the errors above.');
  }
  
  console.log('');
}
