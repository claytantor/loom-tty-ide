import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseRipgrepJson, findInFilesJs, walk } from '../src/search/find-in-files.js';

test('parseRipgrepJson extracts file/line/preview from match events', () => {
  const lines = [
    JSON.stringify({ type: 'begin', data: {} }),
    JSON.stringify({
      type: 'match',
      data: {
        path: { text: 'src/foo.js' },
        lines: { text: 'console.log("hi")\n' },
        line_number: 12,
        absolute_offset: 0,
      },
    }),
    JSON.stringify({ type: 'end', data: {} }),
  ].join('\n');
  const out = parseRipgrepJson(lines);
  assert.deepEqual(out, [{ file: 'src/foo.js', line: 12, preview: 'console.log("hi")' }]);
});

test('parseRipgrepJson tolerates malformed lines', () => {
  const out = parseRipgrepJson('garbage\n\n{not json}\n' + JSON.stringify({
    type: 'match', data: { path: { text: 'a' }, lines: { text: 'L' }, line_number: 1 },
  }));
  assert.equal(out.length, 1);
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-search-'));
  fs.mkdirSync(path.join(root, 'a'));
  fs.mkdirSync(path.join(root, 'node_modules'));
  fs.writeFileSync(path.join(root, 'a', 'one.txt'), 'hello world\nbye world\n');
  fs.writeFileSync(path.join(root, 'a', 'two.txt'), 'no match here\n');
  fs.writeFileSync(path.join(root, 'node_modules', 'skip.txt'), 'world world\n');
  return root;
}

test('walk respects ignore patterns', () => {
  const root = fixture();
  const seen = [...walk(root, ['node_modules'])].map((f) => path.relative(root, f)).sort();
  assert.deepEqual(seen, [path.join('a', 'one.txt'), path.join('a', 'two.txt')]);
});

test('findInFilesJs finds matches and skips ignored dirs', async () => {
  const root = fixture();
  const out = await findInFilesJs({ root, pattern: 'world', ignore: ['node_modules'] });
  assert.equal(out.length, 2);
  assert.ok(out.every((r) => !r.file.includes('node_modules')));
});
