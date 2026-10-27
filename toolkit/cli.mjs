#!/usr/bin/env node
// strudelcli: the whole toolkit behind one command
//
//   strudelcli <command> [args]       run a command
//   strudelcli help [command]         list the commands, or one command's usage
//
// installed by install.sh, which links this file onto the PATH as strudelcli
//
// every command is a module of this directory that reads its own arguments
// from process.argv: the cli rewrites argv and imports it, so a command runs
// exactly as `node <module> args` would. the usage of a command is the
// comment block at the top of its module

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// module: the file that runs the command
const COMMANDS = {
  validate: { module: 'validate.mjs', about: 'check a track works: parses, has events, sounds exist, makes audio' },
  structure: { module: 'structure.mjs', about: 'timeline, section x instrument map, dead definitions (instant)' },
  inspect: { module: 'inspect.mjs', about: 'every instrument: rhythm, notes, key, level, range, overlaps' },
  render: { module: 'render.mjs', about: 'render a track to wav (mix, optionally stems)' },
  review: { module: 'review.mjs', about: 'render with stems and report the mix: LUFS, peaks, balance, clashes' },
  master: { module: 'master.mjs', about: 'master a rendered track to a playable file' },
  find: { module: 'library.mjs', about: 'look up functions, sounds and banks by name (instant)' },
  browse: { module: 'browse.mjs', about: 'find sounds by how they sound, audition candidates (renders)' },
  dj: { module: 'dj.mjs', about: 'live dj sets: queue sections, play them through PipeWire' },
};

// the comment block at the top of a module, without the comment markers
function header(module) {
  const lines = [];
  for (const line of fs.readFileSync(path.join(here, module), 'utf8').split('\n')) {
    if (line.startsWith('#!')) continue;
    if (!line.startsWith('//')) break;
    lines.push(line.replace(/^\/\/ ?/, ''));
  }
  return lines.join('\n');
}

function help(command) {
  if (command && COMMANDS[command]?.module) return console.log(header(COMMANDS[command].module));
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
  const { module } = COMMANDS[command];
  if (!fs.existsSync(path.join(here, 'node_modules'))) {
    console.error('the toolkit is not installed: run toolkit/install.sh');
    process.exit(2);
  }
  const file = path.join(here, module);
  process.argv = [process.argv[0], file, ...rest];
  await import(file);
}
