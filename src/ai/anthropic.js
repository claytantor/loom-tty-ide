import { iterSse } from './sse.js';
import { resolveApiKey } from '../config.js';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export async function complete({ config, prompt, onChunk }) {
  const apiKey = resolveApiKey(config, 'anthropic');
  if (!apiKey) {
    const env = config.ai.anthropic.apiKeyEnv || 'ANTHROPIC_API_KEY';
    throw new Error(`anthropic provider: env var ${env} is not set`);
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: config.ai.anthropic.model,
      max_tokens: 4096,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`anthropic ${res.status}: ${body.slice(0, 300)}`);
  }

  let full = '';
  for await (const ev of iterSse(res)) {
    if (!ev.data) continue;
    if (ev.event === 'content_block_delta') {
      try {
        const obj = JSON.parse(ev.data);
        const text = obj?.delta?.text;
        if (typeof text === 'string' && text.length) {
          full += text;
          onChunk?.(text);
        }
      } catch { /* skip */ }
    } else if (ev.event === 'message_stop') {
      break;
    } else if (ev.event === 'error') {
      throw new Error(`anthropic error event: ${ev.data}`);
    }
  }
  return full;
}
