import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRoot, split, close, leaves, neighbour, layout, newLeafId } from '../src/editor/split-tree.js';

test('makeRoot is a single leaf', () => {
  const r = makeRoot('x');
  assert.deepEqual(leaves(r).map((l) => l.id), ['x']);
});

test('split adds a new leaf and keeps original on the a side', () => {
  const r = makeRoot('a');
  const { tree, newId } = split(r, 'a', 'v', 'b');
  assert.equal(tree.orient, 'v');
  assert.equal(tree.a.id, 'a');
  assert.equal(tree.b.id, 'b');
  assert.equal(newId, 'b');
});

test('close removes a leaf and collapses the parent split', () => {
  const r = split(makeRoot('a'), 'a', 'v', 'b').tree;
  const closed = close(r, 'b');
  assert.equal(closed.id, 'a');
});

test('close on the last leaf returns null', () => {
  assert.equal(close(makeRoot('a'), 'a'), null);
});

test('neighbour walks vertical splits', () => {
  // a | b
  const r = split(makeRoot('a'), 'a', 'v', 'b').tree;
  assert.equal(neighbour(r, 'a', 'l'), 'b');
  assert.equal(neighbour(r, 'b', 'h'), 'a');
  assert.equal(neighbour(r, 'a', 'h'), null);
});

test('neighbour walks horizontal splits', () => {
  // a / b
  const r = split(makeRoot('a'), 'a', 'h', 'b').tree;
  assert.equal(neighbour(r, 'a', 'j'), 'b');
  assert.equal(neighbour(r, 'b', 'k'), 'a');
});

test('layout assigns rectangles', () => {
  const r = split(makeRoot('a'), 'a', 'v', 'b').tree;
  const lay = layout(r, { top: 0, left: 0, width: 100, height: 20 });
  assert.equal(lay.size, 2);
  assert.equal(lay.get('a').width, 50);
  assert.equal(lay.get('b').left, 50);
});

test('newLeafId generates unique ids', () => {
  const a = newLeafId();
  const b = newLeafId();
  assert.notEqual(a, b);
});
