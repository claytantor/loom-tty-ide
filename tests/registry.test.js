import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry, matchScore } from '../src/slash/registry.js';

test('register requires a name', () => {
  const r = createRegistry();
  assert.throws(() => r.register({}), /name/);
});

test('register rejects duplicates', () => {
  const r = createRegistry();
  r.register({ name: 'foo' });
  assert.throws(() => r.register({ name: 'foo' }), /already registered/);
});

test('parse splits name and args', () => {
  const r = createRegistry();
  assert.deepEqual(r.parse('/edit foo.js'), { name: 'edit', args: 'foo.js' });
  assert.deepEqual(r.parse('filetree'), { name: 'filetree', args: '' });
  assert.deepEqual(r.parse('/find regex pattern'), { name: 'find', args: 'regex pattern' });
});

test('filter returns prefix matches first', () => {
  const r = createRegistry();
  ['filetree', 'find', 'format', 'fixme'].forEach((n) => r.register({ name: n }));
  const out = r.filter('fi').map((c) => c.name);
  // prefix "fi" matches: filetree, find, fixme — all score -1, ordered by name.
  // 'format' is a subsequence too; should rank after.
  assert.deepEqual(out.slice(0, 3).sort(), ['filetree', 'find', 'fixme']);
});

test('filter excludes non-matches', () => {
  const r = createRegistry();
  ['edit', 'save', 'quit'].forEach((n) => r.register({ name: n }));
  const out = r.filter('xyz');
  assert.equal(out.length, 0);
});

test('filter is case-insensitive', () => {
  const r = createRegistry();
  r.register({ name: 'CheatSheet' });
  const out = r.filter('cheat');
  assert.equal(out.length, 1);
});

test('matchScore prefers prefix to subsequence', () => {
  // prefix → -1
  assert.equal(matchScore('idx', 'idx-utils.js'), -1);
  // subsequence → 0 or more
  assert.ok(matchScore('idx', 'i-d-handle-x') >= 0);
});

test('find returns null for unknown', () => {
  const r = createRegistry();
  assert.equal(r.find('nope'), null);
});

test('list returns a copy', () => {
  const r = createRegistry();
  r.register({ name: 'a' });
  r.list().push('mutation');
  assert.equal(r.list().length, 1);
});
