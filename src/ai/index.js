import { complete as anthropic } from './anthropic.js';
import { complete as openai } from './openai.js';
import { complete as ollama } from './ollama.js';

const PROVIDERS = { anthropic, openai, ollama };

export async function complete({ config, prompt, onChunk }) {
  const name = config.ai.provider;
  const fn = PROVIDERS[name];
  if (!fn) throw new Error(`unknown ai provider: ${name}`);
  return fn({ config, prompt, onChunk });
}
