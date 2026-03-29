#!/usr/bin/env node

/**
 * Problocks CLI
 *
 * Commands:
 *   problocks init <name> [--template <type>]  — scaffold a new simulation
 *   problocks dev                               — run local preview server
 *   problocks publish                           — bundle and upload to marketplace
 *   problocks build                             — compile simulation for production
 */

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { devCommand } from './commands/dev.js';
import { buildCommand } from './commands/build.js';
import { publishCommand } from './commands/publish.js';

const program = new Command();

program
  .name('problocks')
  .description('Problocks CLI — build, test, and publish educational simulations')
  .version('0.0.1');

program
  .command('init <name>')
  .description('Scaffold a new simulation project')
  .option('-t, --template <type>', 'Template: physics, circuits, chemistry, engineering, biology, math, blank', 'physics')
  .action(initCommand);

program
  .command('dev')
  .description('Start local development preview server')
  .option('-p, --port <number>', 'Port number', '3000')
  .action(devCommand);

program
  .command('build')
  .description('Compile simulation for production')
  .action(buildCommand);

program
  .command('publish')
  .description('Bundle and upload simulation to the Problocks marketplace')
  .option('--patch <message>', 'Publish as patch version (bugfix)')
  .option('--minor <message>', 'Publish as minor version (new feature)')
  .option('--major <message>', 'Publish as major version (breaking change)')
  .action(publishCommand);

program.parse();
