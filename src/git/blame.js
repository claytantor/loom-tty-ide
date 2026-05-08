import { spawn } from 'node:child_process';

// Parse `git blame --porcelain` output → array of {sha, author, summary, line}
export function parseBlamePorcelain(text) {
  const out = [];
  const lines = text.split('\n');
  let cur = null;
  let lineNo = 0;
  for (const line of lines) {
    if (/^[0-9a-f]{7,40} /.test(line)) {
      const parts = line.split(' ');
      const sha = parts[0];
      lineNo = parseInt(parts[2], 10);
      cur = { sha, author: '', summary: '', line: lineNo };
    } else if (cur && line.startsWith('author ')) {
      cur.author = line.slice('author '.length);
    } else if (cur && line.startsWith('summary ')) {
      cur.summary = line.slice('summary '.length);
    } else if (cur && line.startsWith('\t')) {
      out.push(cur);
      cur = null;
    }
  }
  return out;
}

export function blame({ cwd, file }) {
  return new Promise((resolve) => {
    const child = spawn('git', ['blame', '--porcelain', file], { cwd });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', () => resolve([]));
    child.on('close', (code) => {
      if (code !== 0) return resolve([]);
      resolve(parseBlamePorcelain(out));
    });
  });
}
