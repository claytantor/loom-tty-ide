import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_KEYBINDINGS,
  KeybindingsError,
  asArray,
  loadKeybindings,
  mergeKeybindings,
  parseKeybindings,
} from '../src/keybindings.js';

test('loadKeybindings returns defaults when file is missing', () => {
  const kb = loadKeybindings({ path: '/tmp/loom-no-such-keybindings.yml' });
  assert.equal(kb.global.palette, DEFAULT_KEYBINDINGS.global.palette);
  assert.deepEqual(kb.filetree.down, ['j', 'down']);
});

test('mergeKeybindings overrides only specified keys', () => {
  const merged = mergeKeybindings(DEFAULT_KEYBINDINGS, { filetree: { down: 'C-n' } });
  assert.equal(merged.filetree.down, 'C-n');
  assert.deepEqual(merged.filetree.up, ['k', 'up']); // default preserved
  assert.equal(merged.global.palette, '/'); // section untouched
});

test('mergeKeybindings preserves unknown sections from override', () => {
  const merged = mergeKeybindings(DEFAULT_KEYBINDINGS, { plugin: { foo: 'C-x' } });
  assert.equal(merged.plugin.foo, 'C-x');
});

test('parseKeybindings rejects bad YAML', () => {
  assert.throws(() => parseKeybindings(': : : not yaml'), KeybindingsError);
});

test('parseKeybindings rejects non-mapping top level', () => {
  assert.throws(() => parseKeybindings('- a\n- b\n'), KeybindingsError);
});

test('asArray normalises string and array', () => {
  assert.deepEqual(asArray('a'), ['a']);
  assert.deepEqual(asArray(['a', 'b']), ['a', 'b']);
  assert.deepEqual(asArray(null), []);
});

test('loadKeybindings reads from a real file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-kb-'));
  const p = path.join(dir, 'keybindings.yml');
  fs.writeFileSync(p, 'filetree:\n  down: down\n  up: up\n');
  const kb = loadKeybindings({ path: p });
  assert.equal(kb.filetree.down, 'down');
  assert.equal(kb.filetree.up, 'up');
  assert.deepEqual(kb.filetree.expand, ['l', 'right']); // unchanged default
});
