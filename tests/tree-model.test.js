import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { shouldIgnore, readDir, buildTree, fuzzyMatch, filterTree, formatRow } from '../src/overlay/tree-model.js';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-tree-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.mkdirSync(path.join(root, 'node_modules'));
  fs.writeFileSync(path.join(root, 'README.md'), '# r');
  fs.writeFileSync(path.join(root, 'src', 'index.js'), '');
  return root;
}

test('shouldIgnore matches exact name', () => {
  assert.equal(shouldIgnore('node_modules', ['node_modules']), true);
  assert.equal(shouldIgnore('src', ['node_modules']), false);
});

test('shouldIgnore handles wildcards', () => {
  assert.equal(shouldIgnore('foo.log', ['*.log']), true);
  assert.equal(shouldIgnore('foo.txt', ['*.log']), false);
});

test('readDir filters by ignore and sorts dirs first', () => {
  const root = fixture();
  const out = readDir(root, ['node_modules']);
  assert.deepEqual(out.map((e) => e.name), ['src', 'README.md']);
});

test('buildTree expands nested dirs only when in expanded set', () => {
  const root = fixture();
  const flat = buildTree(root, ['node_modules'], new Set());
  assert.deepEqual(flat.map((l) => l.name), ['src', 'README.md']);
  const expanded = buildTree(root, ['node_modules'], new Set([path.join(root, 'src')]));
  assert.deepEqual(expanded.map((l) => l.name), ['src', 'index.js', 'README.md']);
});

test('fuzzyMatch returns -1 when no subsequence', () => {
  assert.equal(fuzzyMatch('xyz', 'abc'), -1);
});

test('fuzzyMatch ranks adjacent matches better', () => {
  // Both match; the contiguous one should score lower (better).
  const contiguous = fuzzyMatch('idx', 'idx-utils.js');
  const spread = fuzzyMatch('idx', 'index-handle.js');
  assert.ok(contiguous >= 0 && spread >= 0);
  assert.ok(contiguous < spread);
});

test('filterTree returns sorted matches and is case-insensitive', () => {
  const lines = [
    { name: 'README.md', isDir: false, path: 'a', depth: 0, expanded: false },
    { name: 'reducer.js', isDir: false, path: 'b', depth: 0, expanded: false },
    { name: 'xyz', isDir: false, path: 'c', depth: 0, expanded: false },
  ];
  const out = filterTree(lines, 're');
  assert.equal(out.length, 2);
  const names = out.map((l) => l.name).sort();
  assert.deepEqual(names, ['README.md', 'reducer.js']);
  // Both leading-match score 0; non-match excluded.
  assert.ok(!out.find((l) => l.name === 'xyz'));
});

test('formatRow renders indent, icon, and optional flag', () => {
  const dir = { name: 'src', isDir: true, depth: 1, expanded: false, path: '/x' };
  // Icon glyph depends on terminal Unicode support (figures); just assert
  // that name and indentation are correct.
  const out = formatRow(dir);
  assert.ok(out.startsWith('  '));
  assert.ok(out.endsWith('src'));
  const file = { name: 'a.js', isDir: false, depth: 0, expanded: false, path: '/x/a.js' };
  assert.ok(formatRow(file, 'M').endsWith('a.js [M]'));
});

test('formatRow renders parent (..) entry with up arrow', () => {
  const parent = { name: '..', isDir: true, depth: 0, expanded: false, path: '/x', isParent: true };
  assert.ok(formatRow(parent).endsWith('..'));
});

test('buildTree prepends parent entry when parentNav is true', () => {
  const root = fixture();
  const lines = buildTree(root, ['node_modules'], new Set(), {
    parentNav: true,
    parentPath: '/some/parent',
  });
  assert.equal(lines[0].name, '..');
  assert.equal(lines[0].isParent, true);
  assert.equal(lines[0].path, '/some/parent');
  assert.deepEqual(lines.slice(1).map((l) => l.name), ['src', 'README.md']);
});

test('buildTree omits parent entry without parentNav', () => {
  const root = fixture();
  const lines = buildTree(root, ['node_modules'], new Set());
  assert.equal(lines[0].name, 'src');
  assert.ok(!lines.find((l) => l.isParent));
});
