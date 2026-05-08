import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSseParser } from '../src/ai/sse.js';

test('createSseParser dispatches single event with data', () => {
  const events = [];
  const feed = createSseParser((e) => events.push(e));
  feed('event: foo\ndata: hello\n\n');
  assert.deepEqual(events, [{ event: 'foo', data: 'hello' }]);
});

test('createSseParser handles multi-line data', () => {
  const events = [];
  const feed = createSseParser((e) => events.push(e));
  feed('data: a\ndata: b\n\n');
  assert.deepEqual(events, [{ event: null, data: 'a\nb' }]);
});

test('createSseParser handles chunked input', () => {
  const events = [];
  const feed = createSseParser((e) => events.push(e));
  feed('event: content_block_delta\nda');
  feed('ta: {"delta":{"text":"hi"}}\n\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'content_block_delta');
  assert.equal(JSON.parse(events[0].data).delta.text, 'hi');
});

test('createSseParser ignores comment lines', () => {
  const events = [];
  const feed = createSseParser((e) => events.push(e));
  feed(': keepalive\n\nevent: real\ndata: x\n\n');
  // First blank line after comment dispatches an empty {event:null,data:null} which is suppressed
  // because both are null.
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'real');
});
