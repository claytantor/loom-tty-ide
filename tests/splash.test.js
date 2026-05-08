import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSplash } from '../src/ui/splash.js';

test('buildSplash includes the LOOM logo', () => {
  const out = buildSplash(120, 30);
  assert.match(out, /LOOM|██/); // logo is rendered with block characters
});

test('buildSplash mentions the cheat sheet hint', () => {
  const out = buildSplash(120, 30);
  assert.match(out, /F1/);
  assert.match(out, /cheat sheet/i);
});

test('buildSplash mentions the slash palette trigger', () => {
  assert.match(buildSplash(120, 30), /command palette/i);
  assert.match(buildSplash(120, 30), /\/filetree/);
});

test('buildSplash works at small terminal sizes without throwing', () => {
  assert.doesNotThrow(() => buildSplash(40, 10));
  assert.doesNotThrow(() => buildSplash(20, 5));
});
