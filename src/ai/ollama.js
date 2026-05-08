// Stub Ollama provider. Returns canned text. No network call.

export async function complete({ prompt, onChunk }) {
  const text = `[ollama stub] received ${prompt.length} chars; provider not yet implemented.`;
  await new Promise((r) => setImmediate(r));
  onChunk?.(text);
  return text;
}
