import fs from 'node:fs';
import path from 'node:path';
import figures from 'figures';

export function shouldIgnore(name, patterns) {
  if (!patterns?.length) return false;
  for (const p of patterns) {
    if (!p) continue;
    if (p === name) return true;
    if (p.includes('*')) {
      const re = new RegExp('^' + p.split('*').map(escapeRe).join('.*') + '$');
      if (re.test(name)) return true;
    }
  }
  return false;
}

function escapeRe(s) { return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'); }

export function readDir(dir, ignore) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return []; }
  const out = [];
  for (const e of entries) {
    if (shouldIgnore(e.name, ignore)) continue;
    out.push({ name: e.name, isDir: e.isDirectory(), path: path.join(dir, e.name) });
  }
  out.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
  return out;
}

export function buildTree(root, ignore, expanded, opts = {}) {
  const lines = [];
  if (opts.parentNav && opts.parentPath) {
    lines.push({
      name: '..',
      isDir: true,
      path: opts.parentPath,
      depth: 0,
      expanded: false,
      isParent: true,
    });
  }
  function walk(dir, depth) {
    for (const e of readDir(dir, ignore)) {
      const isExpanded = expanded.has(e.path);
      lines.push({ ...e, depth, expanded: isExpanded });
      if (e.isDir && isExpanded) walk(e.path, depth + 1);
    }
  }
  walk(root, 0);
  return lines;
}

// Subsequence fuzzy match. Returns score >= 0 (lower = better) or -1 if no match.
export function fuzzyMatch(needle, haystack) {
  if (!needle) return 0;
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();
  let i = 0, j = 0, score = 0, lastIdx = -1;
  while (i < n.length && j < h.length) {
    if (n[i] === h[j]) {
      if (lastIdx === -1) score += j; else score += (j - lastIdx - 1);
      lastIdx = j;
      i++;
    }
    j++;
  }
  if (i < n.length) return -1;
  return score;
}

export function filterTree(lines, query) {
  if (!query) return lines.map((l) => ({ ...l }));
  const out = [];
  for (const l of lines) {
    const score = fuzzyMatch(query, l.name);
    if (score >= 0) out.push({ ...l, score });
  }
  out.sort((a, b) => a.score - b.score);
  return out;
}

// Use `figures` for glyphs so they degrade to ASCII on terminals that
// don't render the Unicode arrows/triangles correctly.
const ICON = {
  parent:   `${figures.arrowUp} `,
  expanded: `${figures.arrowDown} `,
  closed:   `${figures.arrowRight} `,
  file:     '  ',
};

export function formatRow(line, statusFlag = '') {
  const indent = '  '.repeat(line.depth);
  const icon = line.isParent ? ICON.parent
    : line.isDir ? (line.expanded ? ICON.expanded : ICON.closed)
    : ICON.file;
  const flag = statusFlag ? ` [${statusFlag}]` : '';
  return `${indent}${icon}${line.name}${flag}`;
}
