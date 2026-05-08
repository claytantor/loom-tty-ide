import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePorcelainV2 } from '../src/git/status.js';
import { parseBlamePorcelain } from '../src/git/blame.js';

test('parsePorcelainV2 reads modified, untracked, added entries', () => {
  // Records joined by NUL.
  const recs = [
    '1 .M N... 100644 100644 100644 abc def src/foo.js',
    '? new-file.txt',
    '1 A. N... 000000 100644 100644 0000 abc src/added.js',
    '',
  ];
  const out = parsePorcelainV2(recs.join('\0'));
  assert.equal(out.get('src/foo.js'), 'M');
  assert.equal(out.get('new-file.txt'), '?');
  assert.equal(out.get('src/added.js'), 'A');
});

test('parsePorcelainV2 handles rename pairs', () => {
  const recs = [
    '2 R. N... 100644 100644 100644 abc def R100 new/path.js',
    'old/path.js',
    '',
  ];
  const out = parsePorcelainV2(recs.join('\0'));
  assert.equal(out.get('new/path.js'), 'R');
  assert.equal(out.size, 1);
});

test('parseBlamePorcelain extracts sha, author, line', () => {
  const sample = [
    'abcd1234abcd 1 1 1',
    'author Alice',
    'summary first commit',
    '\tline-one-content',
    'beef5678beef 2 2 1',
    'author Bob',
    'summary second',
    '\tline-two-content',
  ].join('\n');
  const out = parseBlamePorcelain(sample);
  assert.equal(out.length, 2);
  assert.equal(out[0].author, 'Alice');
  assert.equal(out[0].sha, 'abcd1234abcd');
  assert.equal(out[1].line, 2);
});
