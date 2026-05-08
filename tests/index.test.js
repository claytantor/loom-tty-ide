import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgv, CliError } from '../src/index.js';

test('parseArgv defaults path to "."', () => {
  assert.deepEqual(parseArgv([]), { path: '.', theme: null, help: false, version: false });
});

test('parseArgv reads positional path', () => {
  assert.equal(parseArgv(['some/dir']).path, 'some/dir');
});

test('parseArgv reads --theme with separate value', () => {
  const r = parseArgv(['--theme', 'solarized-dark', '.']);
  assert.equal(r.theme, 'solarized-dark');
  assert.equal(r.path, '.');
});

test('parseArgv reads --theme=value form', () => {
  assert.equal(parseArgv(['--theme=high-contrast']).theme, 'high-contrast');
});

test('parseArgv recognizes --help and --version', () => {
  assert.equal(parseArgv(['--help']).help, true);
  assert.equal(parseArgv(['-h']).help, true);
  assert.equal(parseArgv(['--version']).version, true);
});

test('parseArgv rejects unknown flags', () => {
  assert.throws(() => parseArgv(['--bogus']), CliError);
});

test('parseArgv rejects --theme with no value', () => {
  assert.throws(() => parseArgv(['--theme']), CliError);
});

test('parseArgv rejects extra positional args', () => {
  assert.throws(() => parseArgv(['a', 'b']), CliError);
});
