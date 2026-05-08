// Stub OpenAI provider. Returns canned text via onChunk to keep the same
// streaming interface. No network call.

export async function complete({ prompt, onChunk }) {
  const text = `[openai stub] received ${prompt.length} chars; provider not yet implemented.`;
  await new Promise((r) => setImmediate(r));
  onChunk?.(text);
  return text;
}
