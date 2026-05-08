// LSP message framing: `Content-Length: N\r\n\r\n<json>`
// Returns parsed messages from a stream of bytes.

export function createFramer(onMessage) {
  let buf = Buffer.alloc(0);
  return function feed(chunk) {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      const headerEnd = indexOfDouble(buf);
      if (headerEnd < 0) return;
      const header = buf.slice(0, headerEnd).toString('utf8');
      const m = /Content-Length:\s*(\d+)/i.exec(header);
      if (!m) {
        // Bad header — drop everything up to this point.
        buf = buf.slice(headerEnd + 4);
        continue;
      }
      const len = parseInt(m[1], 10);
      const total = headerEnd + 4 + len;
      if (buf.length < total) return;
      const body = buf.slice(headerEnd + 4, total).toString('utf8');
      buf = buf.slice(total);
      try { onMessage(JSON.parse(body)); } catch { /* skip malformed */ }
    }
  };
}

function indexOfDouble(b) {
  for (let i = 0; i + 3 < b.length; i++) {
    if (b[i] === 0x0d && b[i + 1] === 0x0a && b[i + 2] === 0x0d && b[i + 3] === 0x0a) return i;
  }
  return -1;
}

export function frame(json) {
  const body = JSON.stringify(json);
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}
