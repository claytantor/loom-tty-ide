import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_THEME, loadTheme } from '../src/theme.js';

function withLoomHome(setup, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-theme-'));
  const themesDir = path.join(dir, 'themes');
  fs.mkdirSync(themesDir, { recursive: true });
  setup(themesDir);
  const prev = process.env.LOOM_HOME;
  process.env.LOOM_HOME = dir;
  try { return fn(); } finally {
    if (prev === undefined) delete process.env.LOOM_HOME; else process.env.LOOM_HOME = prev;
  }
}

test('loadTheme returns bundled default when name=default and nothing in $LOOM_HOME', () => {
  const t = withLoomHome(() => {}, () => loadTheme('default'));
  assert.equal(t.name, 'default');
  assert.equal(t.syntax.keyword, DEFAULT_THEME.syntax.keyword);
});

test('loadTheme prefers user theme over bundled', () => {
  const t = withLoomHome(
    (themesDir) => fs.writeFileSync(path.join(themesDir, 'default.yml'), 'name: my-default\naccent: red\n'),
    () => loadTheme('default'),
  );
  assert.equal(t.name, 'my-default');
  assert.equal(t.accent, 'red');
});

test('loadTheme falls back to default when name is unknown', () => {
  const t = withLoomHome(() => {}, () => loadTheme('does-not-exist'));
  assert.equal(t.name, 'default');
});
