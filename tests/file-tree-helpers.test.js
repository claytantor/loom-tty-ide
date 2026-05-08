import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSubdirOfHome } from '../src/overlay/file-tree.js';

test('isSubdirOfHome true for nested path', () => {
  assert.equal(isSubdirOfHome('/home/u/projects/x', '/home/u'), true);
});

test('isSubdirOfHome false for HOME itself', () => {
  assert.equal(isSubdirOfHome('/home/u', '/home/u'), false);
});

test('isSubdirOfHome false for sibling-prefixed path', () => {
  assert.equal(isSubdirOfHome('/home/user2/x', '/home/u'), false);
});

test('isSubdirOfHome false for outside HOME', () => {
  assert.equal(isSubdirOfHome('/etc', '/home/u'), false);
});
