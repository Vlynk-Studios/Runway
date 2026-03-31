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
import { rollback } from '../src/commands/rollback.js';
import { status } from '../src/commands/status.js';
import { baseline } from '../src/commands/baseline.js';
import { validate } from '../src/commands/validate.js';
import { PostgresAdapter } from '../src/core/adapter/postgres.js';

// Node.js version check
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  logger.error(
    `Runway requires Node.js version 18.0.0 or higher. (Current: ${process.version})`,
  );
  process.exit(1);
}

// 1. Initial configuration
const program = new Command();

program.name('runway').description(pkg.description).version(pkg.version);

// 2. Command Registration
program
  .command('init')
  .description('Initialize a new Runway configuration in the current directory')
  .action(async () => {
    logger.printHeader(pkg.version);
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
  .command('up')
  .description('Alias for migrate: run all pending migrations')
  .alias('migrate')
  .option('-e, --env <path>', 'Specify a custom .env file path')
  .option(
    '-d, --dry-run',
    'Show what would be executed without applying changes',
  )
  .option(
    '--from <version>',
    'Run migrations starting from this version (inclusive)',
  )
  .option('--to <version>', 'Run migrations up to this version (inclusive)')
  .action(async (options) => {
    await migrate(options);
  });

program
  .command('status')
  .description('Show the current status of all migrations')
  .option('-e, --env <path>', 'Specify a custom .env file path')
  .action(async (options) => {
    await status(options);
  });

program
  .command('validate')
  .description('Verify the integrity of all applied migrations')
  .action(async () => {
    await validate();
  });

program
  .command('baseline')
  .description(
    'Mark the current state of the database as baselined without executing SQL',
  )
  .argument(
    '[version]',
    'Optional. Version prefix to baseline up to (e.g. 005)',
  )
  .option('-e, --env <path>', 'Specify a custom .env file path')
  .action(async (version, options) => {
    await baseline(version, options);
  });

program
  .command('rollback')
  .description('Revert the last migration(s) applied to the database')
  .option('-e, --env <path>', 'Specify a custom .env file path')
  .option(
    '-d, --dry-run',
    'Show what would be executed without applying changes',
  )
  .option('-s, --steps <n>', 'Number of migrations to revert', parseInt, 1)
  .action(async (options) => {
    await rollback(options);
  });

// 3. Global error handling
program.on('command:*', () => {
  logger.error(
    `Invalid command: ${program.args.join(' ')}\nSee --help for a list of available commands.`,
  );
  process.exit(1);
});

// 4. Graceful Shutdown Handlers
async function shutdown(signal) {
  if (signal === 'SIGINT') {
    console.log(''); // Move to next line after ^C
    logger.info('Operation cancelled.');
  }

  try {
    const activeCount = PostgresAdapter.instances.size;
    if (activeCount > 0) {
      await PostgresAdapter.closeAll();
    }
  } catch {
    // Silent catch during shutdown
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// 5. Execution
(async () => {
  try {
    await program.parseAsync(process.argv);

    // If no arguments, show help
    if (!process.argv.slice(2).length) {
      program.outputHelp();
    }
  } catch (error) {
    // Handle Inquirer cancellation or other async errors
    if (error.message && (error.message.includes('force closed') || error.message.includes('canceled'))) {
      process.exit(0);
    }
    
    logger.error(error.message);
    process.exit(1);
  }
})();
