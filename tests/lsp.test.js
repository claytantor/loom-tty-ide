import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFramer, frame } from '../src/lsp/framing.js';

test('frame produces a Content-Length header and JSON body', () => {
  const out = frame({ jsonrpc: '2.0', method: 'x' });
  assert.match(out, /^Content-Length: \d+\r\n\r\n\{/);
});

test('createFramer parses a single message', () => {
  const got = [];
  const feed = createFramer((m) => got.push(m));
  feed(Buffer.from(frame({ jsonrpc: '2.0', method: 'a', params: { x: 1 } })));
  assert.equal(got.length, 1);
  assert.equal(got[0].method, 'a');
  assert.equal(got[0].params.x, 1);
});

test('createFramer parses chunked messages', () => {
  const got = [];
  const feed = createFramer((m) => got.push(m));
  const text = frame({ jsonrpc: '2.0', method: 'a' }) + frame({ jsonrpc: '2.0', method: 'b' });
  // Chunk byte-by-byte.
  for (const b of Buffer.from(text)) feed(Buffer.from([b]));
  assert.deepEqual(got.map((m) => m.method), ['a', 'b']);
});

test('createFramer handles UTF-8 byte length correctly', () => {
  const got = [];
  const feed = createFramer((m) => got.push(m));
  feed(Buffer.from(frame({ jsonrpc: '2.0', method: 'utf', params: { s: 'héllo 🌍' } })));
  assert.equal(got[0].params.s, 'héllo 🌍');
});
