import { test } from 'node:test';
import assert from 'node:assert/strict';
import { complete } from '../src/ai/index.js';
import { complete as anthropicComplete } from '../src/ai/anthropic.js';
import { parseConfig } from '../src/config.js';

test('router selects openai stub and forwards onChunk', async () => {
  const cfg = parseConfig('ai:\n  provider: openai\n');
  const chunks = [];
  const out = await complete({ config: cfg, prompt: 'hi', onChunk: (c) => chunks.push(c) });
  assert.equal(typeof out, 'string');
  assert.equal(chunks.length, 1);
  assert.equal(chunks.join(''), out);
});

test('router selects ollama stub', async () => {
  const cfg = parseConfig('ai:\n  provider: ollama\n');
  const out = await complete({ config: cfg, prompt: 'x', onChunk: () => {} });
  assert.match(out, /ollama stub/);
});

test('anthropic provider throws clean error when API key is missing', async () => {
  const cfg = parseConfig('ai:\n  provider: anthropic\n  anthropic:\n    apiKeyEnv: LOOM_NO_SUCH_KEY_PLEASE\n');
  delete process.env.LOOM_NO_SUCH_KEY_PLEASE;
  await assert.rejects(
    anthropicComplete({ config: cfg, prompt: 'p', onChunk: () => {} }),
    /env var LOOM_NO_SUCH_KEY_PLEASE is not set/,
  );
});

test('router rejects unknown provider', async () => {
  // Build a config object directly that bypasses validate()
  const cfg = { ai: { provider: 'martian' } };
  await assert.rejects(complete({ config: cfg, prompt: 'p', onChunk: () => {} }), /unknown ai provider/);
});
