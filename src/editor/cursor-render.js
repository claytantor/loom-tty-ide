// Render a line array with a block cursor + optional gutter + syntax highlight.
// Returns a string suitable for blessed.box setContent() with tags:false.
// The cursor is rendered as ANSI inverse-video so it works regardless of theme.

import { highlightLines } from './highlight.js';

const INVERSE_ON  = '\x1b[7m';
const INVERSE_OFF = '\x1b[27m';
const RESET       = '\x1b[0m';

// Split an ANSI-encoded string at visible column `col`.
// Returns [before, charAtCol, after] where charAtCol is the plain character.
function ansiSplitAt(ansiStr, col) {
  let vis = 0;
  let i   = 0;
  let before = '';

  while (i < ansiStr.length && vis < col) {
    if (ansiStr[i] === '\x1b') {
      // consume entire escape sequence
      let end = i + 1;
      while (end < ansiStr.length && ansiStr[end] !== 'm') end++;
      before += ansiStr.slice(i, end + 1);
      i = end + 1;
    } else {
      before += ansiStr[i];
      vis++;
      i++;
    }
  }

  // Consume one visible character for the cursor slot
  let cursorChar = ' '; // default: past end of line
  if (i < ansiStr.length) {
    if (ansiStr[i] === '\x1b') {
      // escape code right at cursor col — absorb it then grab the next char
      let end = i + 1;
      while (end < ansiStr.length && ansiStr[end] !== 'm') end++;
      before += ansiStr.slice(i, end + 1);
      i = end + 1;
    }
    if (i < ansiStr.length && ansiStr[i] !== '\x1b') {
      cursorChar = ansiStr[i];
      i++;
    }
  }

  const after = ansiStr.slice(i);
  return [before, cursorChar, after];
}

export function renderLines({
  lines,
  cursor,           // {row, col}
  mode,             // 'NORMAL'|'INSERT'|'VISUAL'|'VISUAL_LINE'|'COMMAND'
  visual,           // {row,col} anchor or null
  filePath,
  theme,
  config,
  diagnostics,      // [{line, severity, message}]
  highlightLine,    // transient line highlight (search jump) or -1
  scroll,           // first visible line index
  viewHeight,       // lines visible in pane
  viewWidth,
  showLineNumbers,  // runtime override; falls back to config when undefined
}) {
  const showNums = showLineNumbers ?? (config?.editor?.showLineNumbers !== false);
  const gutterW  = showNums ? String(lines.length).length + 3 : 0; // "N │ "
  const diagByLine = new Map();
  for (const d of (diagnostics || [])) diagByLine.set(d.line, d);

  // Build visual range set for highlight
  const visualRows = new Set();
  let visualStartCol = -1, visualEndCol = -1;
  if ((mode === 'VISUAL' || mode === 'VISUAL_LINE') && visual) {
    const [a, b] = visual.row <= cursor.row
      ? [visual, cursor] : [cursor, visual];
    for (let r = a.row; r <= b.row; r++) visualRows.add(r);
    visualStartCol = a.col;
    visualEndCol   = b.col;
  }

  const highlighted = highlightLines(lines.join('\n'), filePath, theme).split('\n');

  const rendered = lines.map((plainLine, i) => {
    const ansiLine = highlighted[i] ?? plainLine;

    // ── gutter ──────────────────────────────────────────────────────────────
    const diag   = diagByLine.has(i) ? '!' : ' ';
    const numStr = showNums ? String(i + 1).padStart(String(lines.length).length, ' ') + ' │ ' : '';
    const gutter = diag + numStr;

    // ── cursor line ─────────────────────────────────────────────────────────
    if (i === cursor.row) {
      const col = cursor.col;
      const [bef, cur, aft] = ansiSplitAt(ansiLine, col);
      // Reset after cursor so syntax colors resume correctly
      const activeCodes = extractActiveCodes(bef);
      return gutter + bef + INVERSE_ON + cur + INVERSE_OFF + RESET + activeCodes + aft;
    }

    // ── visual highlight ─────────────────────────────────────────────────────
    if (visualRows.has(i) && mode !== 'VISUAL_LINE') {
      const sc = i === (visual?.row ?? -1) ? Math.min(visual?.col ?? 0, visualStartCol) : 0;
      const ec = i === cursor.row           ? visualEndCol + 1                           : plainLine.length;
      const [bef, , aft] = ansiSplitAt(ansiLine, sc);
      const [mid, , rest] = ansiSplitAt(ansiLine.slice(bef.length), ec - sc);
      return gutter + bef + '\x1b[44m' + mid + RESET + rest;
    }
    if (visualRows.has(i) && mode === 'VISUAL_LINE') {
      return gutter + '\x1b[44m' + ansiLine + RESET;
    }

    // ── search/jump highlight ────────────────────────────────────────────────
    if (i === highlightLine) {
      return gutter + '\x1b[43m' + plainLine + RESET;
    }

    return gutter + ansiLine;
  });

  return rendered.join('\n');
}

// Pull out the last active SGR code from a string so we can reapply it after
// the cursor block (prevents syntax colour from bleeding into after-cursor text).
function extractActiveCodes(ansiStr) {
  const re = /\x1b\[[\d;]*m/g;
  let last = '';
  let m;
  while ((m = re.exec(ansiStr)) !== null) last = m[0];
  return last === '\x1b[0m' || last === '\x1b[m' || !last ? '' : last;
}
