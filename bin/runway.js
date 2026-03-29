#!/usr/bin/env node

/**
 * @vlynk-studios/runway
 * CLI tool for project orchestration
 */

import { Command } from 'commander';
import { logger } from '../src/logger.js';
import pkg from '../package.json' with { type: 'json' };

// Subcommands imports
import { init } from '../src/commands/init.js';
import { create } from '../src/commands/create.js';
import { migrate } from '../src/commands/migrate.js';
import { status } from '../src/commands/status.js';
import { baseline } from '../src/commands/baseline.js';

// Node.js version check
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  logger.error(`Runway requires Node.js version 18.0.0 or higher. (Current: ${process.version})`);
  process.exit(1);
}

const program = new Command();

// Global configuration
program
  .name('runway')
  .description(pkg.description)
  .version(pkg.version);

// Visual Header
logger.printHeader(pkg.name, pkg.version);

// Register commands
program
  .command('init')
  .description('Initialize a new Runway configuration in the current directory')
  .action(async () => {
    await init();
  });

program
  .command('create')
  .description('Create a new migration file')
  .argument('<name>', 'Name of the migration')
  .action(async (name) => {
    await create(name);
  });

program
  .command('migrate')
  .description('Run all pending migrations')
  .option('-e, --env <path>', 'Specify a custom .env file path')
  .option('-d, --dry-run', 'Show what would be executed without applying changes')
  .action(async (options) => {
    await migrate(options);
  });

program
  .command('status')
  .description('Show the current status of all migrations')
  .action(async () => {
    await status();
  });

program
  .command('baseline')
  .description('Mark the current state of the database as baselined without executing SQL')
  .argument('[version]', 'Optional. Version prefix to baseline up to (e.g. 005)')
  .action(async (version) => {
    await baseline(version);
  });

program
  .command('rollback')
  .description('Revert the last migration applied (coming in v0.2.0)')
  .action(async () => {
    logger.warn('runway rollback is coming in v0.2.0');
    logger.info('follow progress at github.com/vlynk-studios/runway');
    console.log('');
  });

// Handle unknown commands
program.on('command:*', () => {
  logger.error(`Invalid command: ${program.args.join(' ')}\nSee --help for a list of available commands.`);
  process.exit(1);
});

program.parse(process.argv);

// If no arguments, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
