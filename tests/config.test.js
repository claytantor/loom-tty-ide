import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_CONFIG, ConfigError, deepMerge, loadConfig, parseConfig, resolveApiKey } from '../src/config.js';

function tmpFile(name, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loom-cfg-'));
  const p = path.join(dir, name);
  fs.writeFileSync(p, body);
  return p;
}

test('deepMerge merges nested mappings without mutating inputs', () => {
  const base = { a: 1, b: { c: 2, d: 3 } };
  const out = deepMerge(base, { b: { d: 99, e: 4 } });
  assert.deepEqual(out, { a: 1, b: { c: 2, d: 99, e: 4 } });
  assert.deepEqual(base, { a: 1, b: { c: 2, d: 3 } });
});

test('loadConfig returns defaults when file is missing', () => {
  const cfg = loadConfig({ path: '/tmp/loom-does-not-exist-xyz.yml' });
  assert.equal(cfg.theme, DEFAULT_CONFIG.theme);
  assert.equal(cfg.ai.provider, 'anthropic');
});

test('parseConfig rejects bad YAML with a friendly error', () => {
  assert.throws(() => parseConfig('::: not yaml :::\n  - [unbalanced'), ConfigError);
});

test('parseConfig rejects unknown provider', () => {
  assert.throws(() => parseConfig('ai:\n  provider: bogus\n'), /ai.provider/);
});

test('parseConfig accepts a valid override and overrides defaults', () => {
  const cfg = parseConfig('theme: solarized-dark\neditor:\n  tabSize: 4\n');
  assert.equal(cfg.theme, 'solarized-dark');
  assert.equal(cfg.editor.tabSize, 4);
  assert.equal(cfg.editor.showLineNumbers, false);
});

test('loadConfig reads a real file', () => {
  const p = tmpFile('config.yml', 'theme: high-contrast\n');
  const cfg = loadConfig({ path: p });
  assert.equal(cfg.theme, 'high-contrast');
});

test('resolveApiKey reads the configured env var', () => {
  process.env.LOOM_TEST_KEY = 'sekret';
  const cfg = parseConfig('ai:\n  provider: anthropic\n  anthropic:\n    apiKeyEnv: LOOM_TEST_KEY\n');
  assert.equal(resolveApiKey(cfg, 'anthropic'), 'sekret');
  delete process.env.LOOM_TEST_KEY;
});
