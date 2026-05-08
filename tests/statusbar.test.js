import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeRelative, formatCursor } from '../src/ui/statusbar.js';

test('homeRelative replaces HOME with ~', () => {
  assert.equal(homeRelative('/home/u/projects/foo', '/home/u'), '~/projects/foo');
});

test('homeRelative returns ~ when path is HOME itself', () => {
  assert.equal(homeRelative('/home/u', '/home/u'), '~');
});

test('homeRelative leaves paths outside HOME alone', () => {
  assert.equal(homeRelative('/etc/hosts', '/home/u'), '/etc/hosts');
});

test('homeRelative does not match HOME prefix that is not a directory boundary', () => {
  // /home/user2 is NOT inside /home/u even though it has the same first 6 chars.
  assert.equal(homeRelative('/home/user2/foo', '/home/u'), '/home/user2/foo');
});

test('formatCursor renders 1-indexed Ln/Col with total', () => {
  assert.equal(formatCursor({ row: 0, col: 0, total: 100 }), 'Ln 1/100  Col 1');
  assert.equal(formatCursor({ row: 41, col: 4, total: 100 }), 'Ln 42/100  Col 5');
});

test('formatCursor returns empty for null', () => {
  assert.equal(formatCursor(null), '');
});

test('formatCursor handles missing fields', () => {
  assert.equal(formatCursor({}), 'Ln 1/0  Col 1');
});
