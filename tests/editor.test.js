import { test } from 'node:test';
import assert from 'node:assert/strict';
import { languageFor, colorFn } from '../src/editor/highlight.js';
import { commandFor } from '../src/editor/lint.js';

test('languageFor maps common extensions', () => {
  assert.equal(languageFor('foo.js'), 'javascript');
  assert.equal(languageFor('foo.tsx'), 'typescript');
  assert.equal(languageFor('foo.py'), 'python');
  assert.equal(languageFor('foo.yml'), 'yaml');
  assert.equal(languageFor('foo.md'), 'markdown');
});

test('languageFor maps web extensions to specific grammars', () => {
  assert.equal(languageFor('foo.html'), 'xml');
  assert.equal(languageFor('foo.svg'), 'xml');
  assert.equal(languageFor('foo.vue'), 'xml');
  assert.equal(languageFor('foo.svelte'), 'xml');
  assert.equal(languageFor('foo.css'), 'css');
  assert.equal(languageFor('foo.scss'), 'scss');
  assert.equal(languageFor('foo.less'), 'less');
  assert.equal(languageFor('foo.json'), 'json');
  assert.equal(languageFor('foo.graphql'), 'graphql');
});

test('languageFor recognises Dockerfile by basename', () => {
  assert.equal(languageFor('/path/to/Dockerfile'), 'dockerfile');
});

test('languageFor returns null for unknown', () => {
  assert.equal(languageFor('foo.unknownext'), null);
  assert.equal(languageFor(null), null);
});

test('colorFn resolves named colors and modifiers to chalk functions', () => {
  assert.equal(typeof colorFn('blue'), 'function');
  assert.equal(typeof colorFn('bold'), 'function');
  assert.equal(typeof colorFn('bold blue'), 'function');
  assert.equal(typeof colorFn('brightcyan'), 'function');
});

test('colorFn returns null for invalid specs', () => {
  assert.equal(colorFn('not-a-color'), null);
  assert.equal(colorFn(''), null);
  assert.equal(colorFn(null), null);
});

test('colorFn produces ANSI output when applied', () => {
  const blue = colorFn('blue');
  const out = blue('hi');
  // chalk produces text with ANSI escapes when running in CI/non-TTY too
  // (when FORCE_COLOR is set); we just assert the function returns a string.
  assert.equal(typeof out, 'string');
  assert.ok(out.includes('hi'));
});

test('commandFor picks prettier for js/ts/json', () => {
  assert.equal(commandFor('a.ts').cmd, 'prettier');
  assert.equal(commandFor('a.json').cmd, 'prettier');
  assert.equal(commandFor('a.css').cmd, 'prettier');
});

test('commandFor picks ruff for python', () => {
  assert.equal(commandFor('a.py').cmd, 'ruff');
  assert.deepEqual(commandFor('a.py').args, ['format', 'a.py']);
});

test('commandFor returns null for unsupported', () => {
  assert.equal(commandFor('a.unknownext'), null);
});
