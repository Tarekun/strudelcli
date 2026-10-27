#!/usr/bin/env node
// strudelcli: the whole toolkit behind one command
//
//   strudelcli <command> [args]       run a command
//   strudelcli help [command]         list the commands, or one command's usage
//
// installed by install.sh, which links this file onto the PATH as strudelcli
//
// every command is a module in src/commands that reads its own arguments
// from process.argv: the cli rewrites argv and imports it, so a command runs
// exactly as `node <module> args` would. the usage of a command is the
// comment block at the top of its module

import fs from 'node:fs';
import path from 'node:path';
import { packageRoot } from '../src/paths.mjs';

const moduleOf = (command) => path.join(packageRoot, 'src', 'commands', `${command}.mjs`);

// each command runs src/commands/<name>.mjs
const COMMANDS = {
  validate: { about: 'check a track works: parses, has events, sounds exist, makes audio' },
  structure: { about: 'timeline, section x instrument map, dead definitions (instant)' },
  inspect: { about: 'every instrument: rhythm, notes, key, level, range, overlaps' },
  render: { about: 'render a track to wav (mix, optionally stems)' },
  review: { about: 'render with stems and report the mix: LUFS, peaks, balance, clashes' },
  master: { about: 'master a rendered track to a playable file' },
  find: { about: 'look up functions, sounds and banks by name (instant)' },
  browse: { about: 'find sounds by how they sound, audition candidates (renders)' },
  dj: { about: 'live dj sets: queue sections, play them through PipeWire' },
};

// the comment block at the top of a module, without the comment markers
function header(module) {
  const lines = [];
  for (const line of fs.readFileSync(module, 'utf8').split('\n')) {
    if (line.startsWith('#!')) continue;
    if (!line.startsWith('//')) break;
    lines.push(line.replace(/^\/\/ ?/, ''));
  }
  return lines.join('\n');
}

function help(command) {
  if (command && COMMANDS[command]) return console.log(header(moduleOf(command)));
  if (command && !COMMANDS[command]) console.error(`unknown command: ${command}\n`);
  const width = Math.max(...Object.keys(COMMANDS).map((c) => c.length));
  console.log('usage: strudelcli <command> [args]    (strudelcli help <command> for its options)\n');
  for (const [name, c] of Object.entries(COMMANDS)) console.log(`  ${name.padEnd(width)}  ${c.about}`);
  if (command && !COMMANDS[command]) process.exit(1);
}

// ---------------------------------------------------------------- dispatch

const [command, ...rest] = process.argv.slice(2);
if (!command || command === 'help' || command === '--help' || command === '-h') {
  help(rest[0]);
} else if (!COMMANDS[command]) {
  help(command);
} else if (rest.includes('--help') || rest.includes('-h')) {
  help(command);
} else {
  if (!fs.existsSync(path.join(packageRoot, 'node_modules'))) {
    console.error('the toolkit is not installed: run ./install.sh');
    process.exit(2);
  }
  const file = moduleOf(command);
  process.argv = [process.argv[0], file, ...rest];
  await import(file);
}
