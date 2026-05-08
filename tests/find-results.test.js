import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import stripAnsi from 'strip-ansi';
import { formatRow } from '../src/overlay/find-results.js';

test('formatRow renders path relative to the supplied rootDir', () => {
  const root = '/tmp/proj';
  const r = { file: '/tmp/proj/src/foo.js', line: 42, preview: 'console.log("hi")' };
  const v = stripAnsi(formatRow(r, 100, root));
  assert.ok(v.includes('src/foo.js:42'), `got: ${v}`);
  assert.ok(!v.includes('/tmp/proj'), `absolute path leaked: ${v}`);
});

test('formatRow falls back to process.cwd() when rootDir is omitted', () => {
  const r = { file: path.resolve('foo.js'), line: 1, preview: 'hi' };
  const v = stripAnsi(formatRow(r, 100));
  // Result should be just `foo.js:1` plus separator + preview, no abs path.
  assert.ok(v.startsWith('foo.js:1'), `expected basename start, got: ${v}`);
});

test('formatRow keeps short rows on a single line within the given width', () => {
  const r = { file: '/r/foo.js', line: 42, preview: 'console.log("hi")' };
  const v = stripAnsi(formatRow(r, 80, '/r'));
  assert.ok(v.length <= 80, `expected ≤80 cols, got ${v.length}`);
  assert.ok(v.includes('foo.js:42'));
  assert.ok(v.includes('console.log'));
});

test('formatRow truncates long previews with an ellipsis', () => {
  const longPreview = 'x'.repeat(500);
  const r = { file: '/r/foo.js', line: 1, preview: longPreview };
  const v = stripAnsi(formatRow(r, 60, '/r'));
  assert.ok(v.length <= 60, `got ${v.length} cols`);
  assert.ok(v.includes('…'));
});

test('formatRow truncates long file paths from the front, keeping the tail', () => {
  const root = '/r';
  const deep = '/r/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/file.js';
  const r = { file: deep, line: 999, preview: 'hi' };
  const v = stripAnsi(formatRow(r, 80, root));
  assert.ok(v.includes('file.js:999'), `expected file.js:999 to remain, got: ${v}`);
  assert.ok(v.includes('…'), `expected ellipsis on truncated path, got: ${v}`);
});

test('formatRow collapses tabs/whitespace in the preview', () => {
  const r = { file: '/r/foo.js', line: 1, preview: '\t\tdeeply  indented   \n' };
  const v = stripAnsi(formatRow(r, 80, '/r'));
  assert.ok(!v.endsWith(' '));
  assert.ok(v.includes('deeply  indented'));
});

test('formatRow never overflows the requested width', () => {
  const r = { file: '/r/some/long/path/to/foo.js', line: 12345, preview: 'a'.repeat(200) };
  for (const w of [40, 60, 80, 120, 200]) {
    const v = stripAnsi(formatRow(r, w, '/r'));
    assert.ok(v.length <= w, `width ${w}: got ${v.length} cols → ${JSON.stringify(v)}`);
  }
});

test('formatRow output contains no OSC 8 hyperlink escape sequences', () => {
  const r = { file: '/r/foo.js', line: 1, preview: 'hi' };
  const out = formatRow(r, 80, '/r');
  // OSC 8: ESC ] 8 ; ; URL ESC \  — would render as garbage in blessed.
  assert.ok(!out.includes('\x1b]8;'), 'OSC 8 sequence leaked into output');
});
