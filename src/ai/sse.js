// Minimal SSE event-stream parser. Emits {event, data} per dispatched event.
// `data` is the concatenated `data:` lines as a string.

export function createSseParser(onEvent) {
  let buf = '';
  let current = { event: null, data: null };

  function flush() {
    if (current.data == null && current.event == null) return;
    onEvent(current);
    current = { event: null, data: null };
  }

  function processLine(line) {
    if (line === '') {
      flush();
      return;
    }
    if (line.startsWith(':')) return; // comment
    const colonIdx = line.indexOf(':');
    let field, value;
    if (colonIdx === -1) { field = line; value = ''; }
    else {
      field = line.slice(0, colonIdx);
      value = line.slice(colonIdx + 1);
      if (value.startsWith(' ')) value = value.slice(1);
    }
    if (field === 'event') current.event = value;
    else if (field === 'data') current.data = current.data == null ? value : current.data + '\n' + value;
  }

  return function feed(chunk) {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, '');
      buf = buf.slice(idx + 1);
      processLine(line);
    }
  };
}

export async function* iterSse(response) {
  // Yields {event, data} objects from a fetch Response with an SSE body.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const queue = [];
  let resolveNext;
  let done = false;

  const feed = createSseParser((ev) => {
    if (resolveNext) { const r = resolveNext; resolveNext = null; r(ev); }
    else queue.push(ev);
  });

  (async () => {
    try {
      while (true) {
        const { value, done: d } = await reader.read();
        if (d) break;
        feed(decoder.decode(value, { stream: true }));
      }
    } finally {
      done = true;
      if (resolveNext) { const r = resolveNext; resolveNext = null; r(null); }
    }
  })();

  while (true) {
    if (queue.length) { yield queue.shift(); continue; }
    if (done) return;
    const ev = await new Promise((r) => { resolveNext = r; });
    if (ev === null) return;
    yield ev;
  }
}
