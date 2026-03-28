#!/usr/bin/env node

/**
 * @vlynk-studios/runway
 * CLI tool for project orchestration
 */

const [major] = process.versions.node.split('.').map(Number);

if (major < 18) {
  console.error('Error: Runway requires Node.js version 18.0.0 or higher.');
  console.error(`Currently running on: ${process.version}`);
  process.exit(1);
}

// Proceed with CLI logic
console.log('--- Runway CLI ---');
console.log('Version: 0.1.0-alpha.1');
console.log('Environment check: OK');
