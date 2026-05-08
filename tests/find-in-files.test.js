import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseRipgrepJson, findInFilesJs, walk, globToRegex, matchGlob } from '../src/search/find-in-files.js';

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

test('globToRegex compiles common glob patterns', () => {
  assert.ok(globToRegex('*.py').test('foo.py'));
  assert.ok(!globToRegex('*.py').test('a/foo.py')); // no slash crossing for single *
  assert.ok(globToRegex('foo.py').test('foo.py'));
  assert.ok(!globToRegex('foo.py').test('foo_py'));
  assert.ok(globToRegex('*/*.py').test('src/foo.py'));
  assert.ok(!globToRegex('*/*.py').test('src/sub/foo.py'));
  assert.ok(globToRegex('**/*.py').test('foo.py'));
  assert.ok(globToRegex('**/*.py').test('src/foo.py'));
  assert.ok(globToRegex('**/*.py').test('src/sub/foo.py'));
  assert.ok(globToRegex('src/**/*.ts').test('src/foo.ts'));
  assert.ok(globToRegex('src/**/*.ts').test('src/a/b/foo.ts'));
});

test('matchGlob basenames when glob has no slash, full relpath otherwise', () => {
  // No slash → basename match.
  assert.ok(matchGlob('*.py', 'src/sub/foo.py'));
  assert.ok(matchGlob('foo.py', 'src/sub/foo.py'));
  // Slash present → match against the full relative path.
  assert.ok(matchGlob('src/*.py', 'src/foo.py'));
  assert.ok(!matchGlob('src/*.py', 'src/sub/foo.py'));
  assert.ok(matchGlob('src/**/*.py', 'src/sub/foo.py'));
  // Empty glob = match all.
  assert.ok(matchGlob('', 'anything'));
});

test('findInFilesJs filters by glob', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-glob-'));
  fs.writeFileSync(path.join(root, 'foo.py'), 'def hello():\n  pass\n');
  fs.writeFileSync(path.join(root, 'foo.js'), 'function hello() {}\n');
  fs.mkdirSync(path.join(root, 'sub'));
  fs.writeFileSync(path.join(root, 'sub', 'bar.py'), 'def hello():\n  return 1\n');

  // *.py basename → matches both .py files at any depth
  const allPy = await findInFilesJs({ root, pattern: 'hello', glob: '*.py', ignore: [] });
  const pyFiles = allPy.map((r) => path.relative(root, r.file)).sort();
  assert.deepEqual(pyFiles, ['foo.py', path.join('sub', 'bar.py')]);

  // foo.py basename → only the file literally named foo.py
  const justFoo = await findInFilesJs({ root, pattern: 'hello', glob: 'foo.py', ignore: [] });
  assert.equal(justFoo.length, 1);
  assert.equal(path.basename(justFoo[0].file), 'foo.py');

  // sub/*.py → only sub/bar.py
  const subOnly = await findInFilesJs({ root, pattern: 'hello', glob: 'sub/*.py', ignore: [] });
  assert.equal(subOnly.length, 1);
  assert.equal(path.relative(root, subOnly[0].file), path.join('sub', 'bar.py'));
});
