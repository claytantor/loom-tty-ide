import { spawn } from 'node:child_process';

const EXT_RULES = [
  { exts: ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.json', '.css', '.scss', '.html', '.md', '.yml', '.yaml'],
    cmd: 'prettier', args: (file) => ['--write', file] },
  { exts: ['.py'], cmd: 'ruff', args: (file) => ['format', file] },
];

export function commandFor(filePath) {
  const lower = filePath.toLowerCase();
  for (const rule of EXT_RULES) {
    if (rule.exts.some((e) => lower.endsWith(e))) {
      return { cmd: rule.cmd, args: rule.args(filePath) };
    }
  }
  return null;
}

export function runFormat(filePath) {
  const c = commandFor(filePath);
  if (!c) return Promise.resolve({ ok: false, reason: `no formatter for ${filePath}` });
  return new Promise((resolve) => {
    const child = spawn(c.cmd, c.args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => resolve({ ok: false, reason: e.message }));
    child.on('close', (code) => resolve({ ok: code === 0, code, stdout: out, stderr: err }));
  });
}
