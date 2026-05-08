import { spawn } from 'node:child_process';

// Parse `git status --porcelain=v2 -z`. Returns Map<path, flag>
// where flag is one of M (modified), A (added), D (deleted), ?, R (renamed).
export function parsePorcelainV2(text) {
  const out = new Map();
  // -z gives NUL-separated entries. Most entries are one record; renames are two.
  const recs = text.split('\0');
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    if (!rec) continue;
    const head = rec[0];
    if (head === '?') {
      out.set(rec.slice(2), '?');
      continue;
    }
    if (head === '1') {
      // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
      const parts = rec.split(' ');
      const xy = parts[1] || '';
      const path = parts.slice(8).join(' ');
      if (path) out.set(path, classify(xy));
      continue;
    }
    if (head === '2') {
      // Rename: path is at the end, plus next record is original path.
      const parts = rec.split(' ');
      const path = parts.slice(9).join(' ');
      if (path) out.set(path, 'R');
      i++; // skip original-path record
      continue;
    }
  }
  return out;
}

function classify(xy) {
  if (xy.includes('M')) return 'M';
  if (xy.includes('A')) return 'A';
  if (xy.includes('D')) return 'D';
  if (xy.includes('R')) return 'R';
  return '?';
}

export class GitStatus {
  constructor({ cwd }) {
    this.cwd = cwd;
    this._snapshot = new Map();
    this._pending = null;
    this.refresh();
  }
  invalidate() { this.refresh(); }
  snapshot() { return this._snapshot; }

  refresh() {
    if (this._pending) return this._pending;
    this._pending = new Promise((resolve) => {
      const child = spawn('git', ['status', '--porcelain=v2', '-z'], { cwd: this.cwd });
      let out = '';
      child.stdout.on('data', (d) => { out += d.toString(); });
      child.on('error', () => { this._pending = null; resolve(this._snapshot); });
      child.on('close', () => {
        try { this._snapshot = parsePorcelainV2(out); } catch { /* keep prior */ }
        this._pending = null;
        resolve(this._snapshot);
      });
    });
    return this._pending;
  }
}
