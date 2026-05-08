// Pure vim state machine. No blessed, no file I/O.
// handleKey(state, keyFull, ch) → mutates state in place, returns Action | null.
// Action describes side-effects the caller must perform: save, quit, openFile, etc.

const MAX_UNDO = 200;

export function createState(text = '') {
  const lines = text.split('\n');
  return {
    lines,
    cursor: { row: 0, col: 0 },
    mode: 'NORMAL',       // NORMAL | INSERT | VISUAL | VISUAL_LINE | COMMAND
    countStr: '',         // digit accumulation
    pendingOp: null,      // 'd'|'c'|'y'|'g'|'r'|'z'|'f'|'F'|'t'|'T'|'>'|'<'|'m'|"'"|'@'
    registers: { '"': '', '0': '' },
    undoStack: [],        // [{lines, cursor}]
    redoStack: [],
    lastSearch: '',
    lastSearchDir: 1,     // 1=fwd -1=bwd
    visual: null,         // {row,col} anchor when in VISUAL/VISUAL_LINE
    marks: {},            // letter → {row,col}
    lastFindChar: null,
    lastFindDir: 'f',     // 'f'|'F'|'t'|'T'
    lastChange: null,     // {keys} for '.'
    commandBuf: '',
    scroll: 0,            // top visible line (managed by renderer)
    dirty: false,
  };
}

export function getText(state) { return state.lines.join('\n'); }
export function setText(state, text) {
  state.lines = text.split('\n');
  clampCursor(state);
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function clampCursor(s) {
  s.cursor.row = clamp(s.cursor.row, 0, s.lines.length - 1);
  const maxCol = Math.max(0, s.lines[s.cursor.row].length - (s.mode === 'NORMAL' ? 1 : 0));
  s.cursor.col = clamp(s.cursor.col, 0, maxCol);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function saveUndo(s) {
  s.undoStack.push({ lines: [...s.lines], cursor: { ...s.cursor } });
  if (s.undoStack.length > MAX_UNDO) s.undoStack.shift();
  s.redoStack = [];
  s.dirty = true;
}

function getCount(s) {
  const n = parseInt(s.countStr, 10);
  s.countStr = '';
  return isNaN(n) || n === 0 ? 1 : n;
}

function lineOf(s) { return s.lines[s.cursor.row] || ''; }

function setLine(s, text) { s.lines[s.cursor.row] = text; }

function insertText(s, text) {
  const line = lineOf(s);
  const col = s.cursor.col;
  setLine(s, line.slice(0, col) + text + line.slice(col));
  s.cursor.col += text.length;
}

function deleteChar(s, col) {
  const line = lineOf(s);
  if (col < 0 || col >= line.length) return '';
  setLine(s, line.slice(0, col) + line.slice(col + 1));
  return line[col];
}

function yankToRegister(s, text, reg = '"') {
  s.registers[reg] = text;
  s.registers['"'] = text;
}

// ─── motions ──────────────────────────────────────────────────────────────────

function motionLeft(s, n = 1) {
  s.cursor.col = Math.max(0, s.cursor.col - n);
}
function motionRight(s, n = 1) {
  const max = Math.max(0, lineOf(s).length - (s.mode === 'NORMAL' ? 1 : 0));
  s.cursor.col = Math.min(max, s.cursor.col + n);
}
function motionDown(s, n = 1) {
  s.cursor.row = Math.min(s.lines.length - 1, s.cursor.row + n);
  clampCursor(s);
}
function motionUp(s, n = 1) {
  s.cursor.row = Math.max(0, s.cursor.row - n);
  clampCursor(s);
}

function motionLineStart(s) { s.cursor.col = 0; }
function motionLineEnd(s) {
  s.cursor.col = Math.max(0, lineOf(s).length - (s.mode === 'NORMAL' ? 1 : 0));
}
function motionFirstNonBlank(s) {
  const m = lineOf(s).match(/^(\s*)/);
  s.cursor.col = m ? m[1].length : 0;
}

const WORD_CHARS   = /\w/;
const WORD_CHARS_W = /\S/;

function wordRe(big) { return big ? WORD_CHARS_W : WORD_CHARS; }
function wordBoundary(ch, re) { return re.test(ch); }

function motionWordStart(s, big = false, forward = true) {
  const re = wordRe(big);
  let { row, col } = s.cursor;
  let line = s.lines[row];
  if (forward) {
    col++;
    // skip current word chars
    while (col < line.length && re.test(line[col])) col++;
    // skip non-word
    while (col < line.length && !re.test(line[col])) col++;
    if (col >= line.length && row < s.lines.length - 1) {
      row++;
      line = s.lines[row];
      col = 0;
      while (col < line.length && !re.test(line[col])) col++;
    }
  } else {
    col--;
    while (col >= 0 && !re.test(line[col])) col--;
    while (col > 0 && re.test(line[col - 1])) col--;
    if (col < 0 && row > 0) {
      row--;
      line = s.lines[row];
      col = line.length - 1;
      while (col > 0 && re.test(line[col - 1])) col--;
    }
  }
  s.cursor.row = clamp(row, 0, s.lines.length - 1);
  s.cursor.col = clamp(Math.max(0, col), 0, Math.max(0, s.lines[s.cursor.row].length - 1));
}

function motionWordEnd(s, big = false, forward = true) {
  const re = wordRe(big);
  let { row, col } = s.cursor;
  let line = s.lines[row];
  if (forward) {
    col++;
    if (col >= line.length && row < s.lines.length - 1) {
      row++; line = s.lines[row]; col = 0;
    }
    while (col < line.length - 1 && !re.test(line[col])) col++;
    while (col < line.length - 1 && re.test(line[col + 1])) col++;
  } else {
    col--;
    if (col < 0 && row > 0) {
      row--; line = s.lines[row]; col = line.length - 1;
    }
    while (col > 0 && !re.test(line[col])) col--;
    while (col > 0 && re.test(line[col - 1])) col--;
  }
  s.cursor.row = clamp(row, 0, s.lines.length - 1);
  s.cursor.col = clamp(Math.max(0, col), 0, Math.max(0, s.lines[s.cursor.row].length - 1));
}

function motionGo(s, row) {
  s.cursor.row = clamp(row, 0, s.lines.length - 1);
  motionFirstNonBlank(s);
}

function motionParagraph(s, forward) {
  let row = s.cursor.row;
  if (forward) {
    row++;
    while (row < s.lines.length - 1 && s.lines[row].trim()) row++;
    while (row < s.lines.length - 1 && !s.lines[row].trim()) row++;
  } else {
    row--;
    while (row > 0 && s.lines[row].trim()) row--;
    while (row > 0 && !s.lines[row - 1].trim()) row--;
  }
  s.cursor.row = clamp(row, 0, s.lines.length - 1);
  clampCursor(s);
}

function motionFindChar(s, ch, dir, till = false) {
  const line = lineOf(s);
  const col = s.cursor.col;
  if (dir === 'f' || dir === 't') {
    for (let i = col + 1; i < line.length; i++) {
      if (line[i] === ch) { s.cursor.col = till ? i - 1 : i; return; }
    }
  } else {
    for (let i = col - 1; i >= 0; i--) {
      if (line[i] === ch) { s.cursor.col = till ? i + 1 : i; return; }
    }
  }
}

// ─── text objects ─────────────────────────────────────────────────────────────

function innerWord(s, big = false) {
  const re = wordRe(big);
  const line = lineOf(s);
  let start = s.cursor.col, end = s.cursor.col;
  if (!re.test(line[start])) return null; // cursor on whitespace
  while (start > 0 && re.test(line[start - 1])) start--;
  while (end < line.length - 1 && re.test(line[end + 1])) end++;
  return { row: s.cursor.row, startCol: start, endCol: end + 1 };
}

// ─── range extraction ─────────────────────────────────────────────────────────

// Returns {startRow, startCol, endRow, endCol, text, linewise}
function resolveRange(s, op, motion) {
  const saved = { row: s.cursor.row, col: s.cursor.col };
  applyMotion(s, motion);
  const end = { row: s.cursor.row, col: s.cursor.col };
  s.cursor = saved;
  const linewise = isLinewiseMotion(motion);
  if (linewise) {
    const [r1, r2] = [saved.row, end.row].sort((a, b) => a - b);
    return { startRow: r1, endRow: r2, startCol: 0, endCol: 0, linewise: true,
      text: s.lines.slice(r1, r2 + 1).join('\n') };
  }
  let [start, fin] = orderPositions(saved, end);
  return { startRow: start.row, startCol: start.col, endRow: fin.row, endCol: fin.col,
    linewise: false, text: extractRange(s, start, fin) };
}

function isLinewiseMotion(m) {
  return ['j','k','up','down','gg','G','H','M','L','{','}'].includes(m)
    || /^\d+(j|k|G)$/.test(m);
}

function orderPositions(a, b) {
  if (a.row < b.row || (a.row === b.row && a.col <= b.col)) return [a, b];
  return [b, a];
}

function extractRange(s, start, end) {
  if (start.row === end.row) return s.lines[start.row].slice(start.col, end.col + 1);
  const parts = [s.lines[start.row].slice(start.col)];
  for (let r = start.row + 1; r < end.row; r++) parts.push(s.lines[r]);
  parts.push(s.lines[end.row].slice(0, end.col + 1));
  return parts.join('\n');
}

// ─── operators ────────────────────────────────────────────────────────────────

function deleteRange(s, startRow, startCol, endRow, endCol, linewise) {
  if (linewise) {
    const yanked = s.lines.splice(startRow, endRow - startRow + 1).join('\n');
    if (s.lines.length === 0) s.lines.push('');
    s.cursor.row = clamp(startRow, 0, s.lines.length - 1);
    motionFirstNonBlank(s);
    return yanked;
  }
  if (startRow === endRow) {
    const line = s.lines[startRow];
    const yanked = line.slice(startCol, endCol);
    s.lines[startRow] = line.slice(0, startCol) + line.slice(endCol);
    s.cursor.col = startCol;
    clampCursor(s);
    return yanked;
  }
  const first = s.lines[startRow].slice(0, startCol);
  const last = s.lines[endRow].slice(endCol);
  const yanked = s.lines[startRow].slice(startCol) + '\n' +
    s.lines.slice(startRow + 1, endRow).join('\n') + '\n' + s.lines[endRow].slice(0, endCol);
  s.lines.splice(startRow, endRow - startRow + 1, first + last);
  s.cursor.row = startRow;
  s.cursor.col = startCol;
  clampCursor(s);
  return yanked;
}

// ─── indent/dedent ────────────────────────────────────────────────────────────

function indentLines(s, startRow, endRow, dir, tabSize = 2) {
  const pad = ' '.repeat(tabSize);
  for (let r = startRow; r <= endRow; r++) {
    if (dir > 0) s.lines[r] = pad + s.lines[r];
    else s.lines[r] = s.lines[r].replace(new RegExp(`^ {1,${tabSize}}`), '');
  }
  clampCursor(s);
}

// ─── search ───────────────────────────────────────────────────────────────────

function searchForward(s, pattern, fromRow, fromCol, wrapAround = true) {
  const re = new RegExp(pattern);
  const n = s.lines.length;
  for (let offset = 0; offset < n; offset++) {
    const r = (fromRow + offset) % n;
    const startCol = offset === 0 ? fromCol + 1 : 0;
    const m = s.lines[r].slice(startCol).match(re);
    if (m) return { row: r, col: startCol + m.index };
    if (!wrapAround && r < fromRow) return null;
  }
  return null;
}

function searchBackward(s, pattern, fromRow, fromCol, wrapAround = true) {
  const re = new RegExp(pattern);
  const n = s.lines.length;
  for (let offset = 0; offset < n; offset++) {
    const r = ((fromRow - offset) % n + n) % n;
    const line = offset === 0 ? s.lines[r].slice(0, fromCol) : s.lines[r];
    let last = null, m;
    const g = new RegExp(re.source, 'g');
    while ((m = g.exec(line)) !== null) last = { row: r, col: m.index };
    if (last) return last;
    if (!wrapAround && r > fromRow) return null;
  }
  return null;
}

// ─── apply motions for operator ranges ───────────────────────────────────────

function applyMotion(s, motion) {
  switch (motion) {
    case 'h': motionLeft(s); break;
    case 'l': motionRight(s); break;
    case 'j': case 'down': motionDown(s); break;
    case 'k': case 'up': motionUp(s); break;
    case 'w': motionWordStart(s, false, true); break;
    case 'W': motionWordStart(s, true, true); break;
    case 'b': motionWordStart(s, false, false); break;
    case 'B': motionWordStart(s, true, false); break;
    case 'e': motionWordEnd(s, false, true); break;
    case 'E': motionWordEnd(s, true, true); break;
    case '$': motionLineEnd(s); break;
    case '0': motionLineStart(s); break;
    case '^': motionFirstNonBlank(s); break;
    case 'gg': motionGo(s, 0); break;
    case 'G': motionGo(s, s.lines.length - 1); break;
    case '{': motionParagraph(s, false); break;
    case '}': motionParagraph(s, true); break;
  }
}

// ─── visual range ─────────────────────────────────────────────────────────────

function visualRange(s) {
  const anchor = s.visual;
  const cur = s.cursor;
  const [a, b] = orderPositions(anchor, cur);
  if (s.mode === 'VISUAL_LINE') {
    const [r1, r2] = [Math.min(anchor.row, cur.row), Math.max(anchor.row, cur.row)];
    return { startRow: r1, endRow: r2, startCol: 0, endCol: 0, linewise: true,
      text: s.lines.slice(r1, r2 + 1).join('\n') };
  }
  return { startRow: a.row, startCol: a.col, endRow: b.row, endCol: b.col + 1,
    linewise: false, text: extractRange(s, a, { row: b.row, col: b.col }) };
}

// ─── enter insert at specific position ───────────────────────────────────────

function enterInsert(s) {
  s.mode = 'INSERT';
  s.pendingOp = null;
  s.countStr = '';
}

// ─── main key handler ─────────────────────────────────────────────────────────
// Returns null or an Action: { type, ...data }

export function handleKey(s, keyFull, ch) {
  if (s.mode === 'INSERT') return handleInsert(s, keyFull, ch);
  if (s.mode === 'COMMAND') return handleCommand(s, keyFull, ch);
  if (s.mode === 'VISUAL' || s.mode === 'VISUAL_LINE') return handleVisual(s, keyFull, ch);
  return handleNormal(s, keyFull, ch);
}

// ─── NORMAL mode ──────────────────────────────────────────────────────────────

function handleNormal(s, key, ch) {
  // Count prefix
  if (/^[1-9]$/.test(ch) && !s.pendingOp) { s.countStr += ch; return null; }
  if (ch === '0' && s.countStr) { s.countStr += '0'; return null; }

  const count = s.countStr ? (parseInt(s.countStr, 10) || 1) : 1;

  // Pending two-key ops
  if (s.pendingOp) return handlePending(s, key, ch, count);

  switch (key) {
    // ── movement ──
    case 'h': case 'left':  for (let i=0;i<count;i++) motionLeft(s); break;
    case 'l': case 'right': for (let i=0;i<count;i++) motionRight(s); break;
    case 'j': case 'down':  motionDown(s, count); break;
    case 'k': case 'up':    motionUp(s, count); break;
    case 'w': for (let i=0;i<count;i++) motionWordStart(s,false,true); break;
    case 'W': for (let i=0;i<count;i++) motionWordStart(s,true,true); break;
    case 'b': for (let i=0;i<count;i++) motionWordStart(s,false,false); break;
    case 'B': for (let i=0;i<count;i++) motionWordStart(s,true,false); break;
    case 'e': for (let i=0;i<count;i++) motionWordEnd(s,false,true); break;
    case 'E': for (let i=0;i<count;i++) motionWordEnd(s,true,true); break;
    case '0': motionLineStart(s); break;
    case '^': motionFirstNonBlank(s); break;
    case '$': for (let i=0;i<count-1;i++) motionDown(s); motionLineEnd(s); break;
    case 'G': motionGo(s, s.countStr ? count - 1 : s.lines.length - 1); break;
    case '{': for (let i=0;i<count;i++) motionParagraph(s,false); break;
    case '}': for (let i=0;i<count;i++) motionParagraph(s,true); break;
    case 'C-d': case 'pagedown': s.countStr=''; return { type:'scroll', dir:1, half:true };
    case 'C-u': case 'pageup':   s.countStr=''; return { type:'scroll', dir:-1, half:true };
    case 'C-f': motionGo(s, Math.min(s.lines.length-1, s.cursor.row + count * 20)); break;
    case 'C-b': motionGo(s, Math.max(0, s.cursor.row - count * 20)); break;
    case 'C-e': s.countStr=''; return { type:'scroll', dir:1, lines:count };
    case 'C-y': s.countStr=''; return { type:'scroll', dir:-1, lines:count };
    case 'H': s.countStr=''; return { type:'screenMotion', pos:'top', count };
    case 'M': s.countStr=''; return { type:'screenMotion', pos:'mid' };
    case 'L': s.countStr=''; return { type:'screenMotion', pos:'bot', count };
    case 'zz': s.countStr=''; return { type:'centerCursor' };
    case 'zt': s.countStr=''; return { type:'scrollToCursor', align:'top' };
    case 'zb': s.countStr=''; return { type:'scrollToCursor', align:'bot' };
    case '%': matchBracket(s); break;

    // ── pending two-key ──
    case 'g': case 'f': case 'F': case 't': case 'T':
    case 'r': case 'z': case 'm': case "'":
      s.pendingOp = key; s.countStr = String(count); return null;

    // ── operators (start) ──
    case 'd': s.pendingOp='d'; s.countStr=String(count); return null;
    case 'c': s.pendingOp='c'; s.countStr=String(count); return null;
    case 'y': s.pendingOp='y'; s.countStr=String(count); return null;
    case '>': s.pendingOp='>'; s.countStr=String(count); return null;
    case '<': s.pendingOp='<'; s.countStr=String(count); return null;

    // ── single-key edits ──
    case 'x': {
      saveUndo(s);
      const yanked = deleteChar(s, s.cursor.col);
      yankToRegister(s, yanked);
      clampCursor(s);
      s.lastChange = { key: 'x' };
      break;
    }
    case 'X': {
      if (s.cursor.col === 0) break;
      saveUndo(s);
      s.cursor.col--;
      const yanked = deleteChar(s, s.cursor.col);
      yankToRegister(s, yanked);
      s.lastChange = { key: 'X' };
      break;
    }
    case 'D': {
      saveUndo(s);
      const line = lineOf(s);
      const yanked = line.slice(s.cursor.col);
      yankToRegister(s, yanked);
      setLine(s, line.slice(0, s.cursor.col));
      clampCursor(s);
      s.lastChange = { key: 'D' };
      break;
    }
    case 'C': {
      saveUndo(s);
      const line = lineOf(s);
      yankToRegister(s, line.slice(s.cursor.col));
      setLine(s, line.slice(0, s.cursor.col));
      enterInsert(s);
      s.lastChange = { key: 'C' };
      break;
    }
    case 'J': {
      saveUndo(s);
      for (let i = 0; i < count; i++) {
        if (s.cursor.row >= s.lines.length - 1) break;
        const line = s.lines[s.cursor.row];
        const next = s.lines[s.cursor.row + 1].trimStart();
        s.lines.splice(s.cursor.row, 2, line + (next ? ' ' + next : ''));
      }
      s.lastChange = { key: 'J', count };
      break;
    }
    case 's': {
      saveUndo(s);
      const yanked = deleteChar(s, s.cursor.col);
      yankToRegister(s, yanked);
      enterInsert(s);
      s.lastChange = { key: 's' };
      break;
    }
    case 'S': {
      saveUndo(s);
      yankToRegister(s, lineOf(s));
      setLine(s, '');
      s.cursor.col = 0;
      enterInsert(s);
      s.lastChange = { key: 'S' };
      break;
    }
    case '~': {
      saveUndo(s);
      const line = lineOf(s);
      const ch2 = line[s.cursor.col];
      if (ch2) {
        const toggled = ch2 === ch2.toUpperCase() ? ch2.toLowerCase() : ch2.toUpperCase();
        setLine(s, line.slice(0, s.cursor.col) + toggled + line.slice(s.cursor.col + 1));
        motionRight(s);
      }
      break;
    }
    case 'p': {
      const text = s.registers['"'] || '';
      saveUndo(s);
      pasteAfter(s, text);
      s.lastChange = { key: 'p' };
      break;
    }
    case 'P': {
      const text = s.registers['"'] || '';
      saveUndo(s);
      pasteBefore(s, text);
      s.lastChange = { key: 'P' };
      break;
    }
    case 'u': {
      if (!s.undoStack.length) break;
      s.redoStack.push({ lines: [...s.lines], cursor: { ...s.cursor } });
      const prev = s.undoStack.pop();
      s.lines = prev.lines;
      s.cursor = prev.cursor;
      s.dirty = true;
      break;
    }
    case 'C-r': {
      if (!s.redoStack.length) break;
      s.undoStack.push({ lines: [...s.lines], cursor: { ...s.cursor } });
      const next = s.redoStack.pop();
      s.lines = next.lines;
      s.cursor = next.cursor;
      s.dirty = true;
      break;
    }
    case '.': if (s.lastChange) return replayLastChange(s); break;

    // ── insert mode entry ──
    case 'i': enterInsert(s); break;
    case 'I': motionFirstNonBlank(s); enterInsert(s); break;
    case 'a': {
      const max = lineOf(s).length;
      if (s.cursor.col < max) s.cursor.col++;
      enterInsert(s); break;
    }
    case 'A': motionLineEnd(s); s.cursor.col = lineOf(s).length; enterInsert(s); break;
    case 'o': {
      saveUndo(s);
      s.lines.splice(s.cursor.row + 1, 0, '');
      s.cursor.row++;
      s.cursor.col = 0;
      enterInsert(s); break;
    }
    case 'O': {
      saveUndo(s);
      s.lines.splice(s.cursor.row, 0, '');
      s.cursor.col = 0;
      enterInsert(s); break;
    }

    // ── visual mode ──
    case 'v': s.mode='VISUAL'; s.visual={...s.cursor}; break;
    case 'V': s.mode='VISUAL_LINE'; s.visual={...s.cursor}; break;

    // ── search ──
    case '/': s.countStr=''; return { type: 'promptSearch', dir: 1 };
    case '?': s.countStr=''; return { type: 'promptSearch', dir: -1 };
    case 'n': searchNext(s, s.lastSearchDir); break;
    case 'N': searchNext(s, -s.lastSearchDir); break;
    case '*': {
      const word = wordUnderCursor(s);
      if (word) { s.lastSearch=`\\b${word}\\b`; s.lastSearchDir=1; searchNext(s,1); }
      break;
    }
    case '#': {
      const word = wordUnderCursor(s);
      if (word) { s.lastSearch=`\\b${word}\\b`; s.lastSearchDir=-1; searchNext(s,-1); }
      break;
    }

    // ── file commands ──
    case ':': s.mode='COMMAND'; s.commandBuf=''; return null;

    // ── save shortcut ──
    case 'C-s': return { type: 'save' };

    // ── escape ──
    case 'escape': s.pendingOp=null; s.countStr=''; break;

    default: s.countStr = ''; break;
  }
  if (s.mode === 'NORMAL') s.countStr = '';
  return null;
}

// ─── pending two-key handler ──────────────────────────────────────────────────

function handlePending(s, key, ch, count) {
  const op = s.pendingOp;
  s.pendingOp = null;
  s.countStr = '';

  if (op === 'g') {
    switch (key) {
      case 'g': motionGo(s, 0); break;
      case 'e': for (let i=0;i<count;i++) motionWordEnd(s,false,false); break;
      case 'E': for (let i=0;i<count;i++) motionWordEnd(s,true,false); break;
      case 'j': case 'down': motionDown(s,count); break;
      case 'k': case 'up':   motionUp(s,count); break;
      case '~': caseOpLine(s, 'toggle'); break;
      case 'u': caseOpLine(s, 'lower'); break;
      case 'U': caseOpLine(s, 'upper'); break;
      default: break;
    }
    return null;
  }

  if (op === 'f' || op === 'F' || op === 't' || op === 'T') {
    if (!ch) return null;
    s.lastFindChar = ch;
    s.lastFindDir = op;
    for (let i=0;i<count;i++) motionFindChar(s, ch, op, op==='t'||op==='T');
    return null;
  }

  if (op === ';') { if (s.lastFindChar) motionFindChar(s,s.lastFindChar,s.lastFindDir,s.lastFindDir==='t'||s.lastFindDir==='T'); return null; }
  if (op === ',') {
    if (s.lastFindChar) {
      const inv = {f:'F',F:'f',t:'T',T:'t'}[s.lastFindDir] || s.lastFindDir;
      motionFindChar(s,s.lastFindChar,inv,inv==='t'||inv==='T');
    }
    return null;
  }

  if (op === 'r') {
    if (!ch) return null;
    saveUndo(s);
    const line = lineOf(s);
    if (s.cursor.col < line.length) {
      setLine(s, line.slice(0, s.cursor.col) + ch + line.slice(s.cursor.col + 1));
    }
    s.lastChange = { key: `r${ch}` };
    return null;
  }

  if (op === 'm') {
    if (ch && /[a-zA-Z`0-9]/.test(ch)) s.marks[ch] = { ...s.cursor };
    return null;
  }

  if (op === "'") {
    const mark = s.marks[ch];
    if (mark) { s.cursor.row = mark.row; motionFirstNonBlank(s); }
    return null;
  }

  if (op === 'z') {
    if (key === 'z') return { type: 'centerCursor' };
    if (key === 't') return { type: 'scrollToCursor', align: 'top' };
    if (key === 'b') return { type: 'scrollToCursor', align: 'bot' };
    return null;
  }

  if (op === 'd' || op === 'c' || op === 'y') {
    // dd/cc/yy
    if (ch === op[0]) {
      saveUndo(s);
      const r1 = s.cursor.row;
      const r2 = Math.min(s.lines.length - 1, r1 + count - 1);
      const yanked = s.lines.slice(r1, r2 + 1).join('\n');
      yankToRegister(s, yanked + '\n');
      if (op !== 'y') {
        s.lines.splice(r1, r2 - r1 + 1);
        if (s.lines.length === 0) s.lines.push('');
        s.cursor.row = clamp(r1, 0, s.lines.length - 1);
        motionFirstNonBlank(s);
      }
      if (op === 'c') enterInsert(s);
      s.lastChange = { key: `${op}${op}`, count };
      return null;
    }
    // iw/aw
    if (ch === 'w' && (op === 'd' || op === 'c' || op === 'y')) {
      const rng = innerWord(s);
      if (!rng) return null;
      saveUndo(s);
      const yanked = s.lines[rng.row].slice(rng.startCol, rng.endCol);
      yankToRegister(s, yanked);
      if (op !== 'y') {
        s.lines[rng.row] = s.lines[rng.row].slice(0, rng.startCol) + s.lines[rng.row].slice(rng.endCol);
        s.cursor.col = rng.startCol;
        clampCursor(s);
      }
      if (op === 'c') enterInsert(s);
      s.lastChange = { key: `${op}w` };
      return null;
    }
    // motion-based
    const savedCursor = { ...s.cursor };
    applyMotion(s, key);
    const endCursor = { ...s.cursor };
    s.cursor = savedCursor;
    saveUndo(s);
    const linewise = isLinewiseMotion(key);
    let yanked;
    if (linewise) {
      const [r1, r2] = [Math.min(savedCursor.row, endCursor.row),
                        Math.max(savedCursor.row, endCursor.row)];
      yanked = s.lines.slice(r1, r2 + 1).join('\n');
      if (op !== 'y') {
        s.lines.splice(r1, r2 - r1 + 1);
        if (s.lines.length === 0) s.lines.push('');
        s.cursor.row = clamp(r1, 0, s.lines.length - 1);
        motionFirstNonBlank(s);
      }
    } else {
      const [a, b] = orderPositions(savedCursor, endCursor);
      yanked = deleteRange(s, a.row, a.col,
        op === 'y' ? b.row : b.row,
        op === 'y' ? b.col + 1 : b.col + 1,
        false);
    }
    yankToRegister(s, yanked);
    if (op === 'c') enterInsert(s);
    s.lastChange = { key: `${op}${key}`, count };
    return null;
  }

  if (op === '>' || op === '<') {
    const dir = op === '>' ? 1 : -1;
    const r1 = s.cursor.row;
    const r2 = Math.min(s.lines.length - 1, r1 + count - 1);
    saveUndo(s);
    indentLines(s, r1, r2, dir);
    s.lastChange = { key: `${op}${op}`, count };
    return null;
  }

  return null;
}

// ─── INSERT mode ──────────────────────────────────────────────────────────────

function handleInsert(s, key, ch) {
  switch (key) {
    case 'escape': case 'C-c':
      s.mode = 'NORMAL';
      // move cursor back one unless at start of line
      if (s.cursor.col > 0) s.cursor.col--;
      s.dirty = true;
      return null;
    case 'C-s': return { type: 'save' };
    case 'backspace': case 'C-h': {
      if (s.cursor.col > 0) {
        setLine(s, lineOf(s).slice(0, s.cursor.col - 1) + lineOf(s).slice(s.cursor.col));
        s.cursor.col--;
      } else if (s.cursor.row > 0) {
        const above = s.lines[s.cursor.row - 1];
        const col = above.length;
        s.lines[s.cursor.row - 1] = above + s.lines[s.cursor.row];
        s.lines.splice(s.cursor.row, 1);
        s.cursor.row--;
        s.cursor.col = col;
      }
      s.dirty = true;
      break;
    }
    case 'delete': {
      const line = lineOf(s);
      if (s.cursor.col < line.length) {
        setLine(s, line.slice(0, s.cursor.col) + line.slice(s.cursor.col + 1));
      } else if (s.cursor.row < s.lines.length - 1) {
        s.lines[s.cursor.row] = line + s.lines[s.cursor.row + 1];
        s.lines.splice(s.cursor.row + 1, 1);
      }
      s.dirty = true;
      break;
    }
    case 'enter': {
      const line = lineOf(s);
      const indent = line.match(/^(\s*)/)[1];
      const after = line.slice(s.cursor.col);
      setLine(s, line.slice(0, s.cursor.col));
      s.lines.splice(s.cursor.row + 1, 0, indent + after);
      s.cursor.row++;
      s.cursor.col = indent.length;
      s.dirty = true;
      break;
    }
    case 'tab': {
      const spaces = '  '; // tabSize=2; caller can override
      insertText(s, spaces);
      s.dirty = true;
      break;
    }
    case 'C-w': {
      let col = s.cursor.col;
      const line = lineOf(s);
      while (col > 0 && /\s/.test(line[col-1])) col--;
      while (col > 0 && /\S/.test(line[col-1])) col--;
      setLine(s, line.slice(0, col) + line.slice(s.cursor.col));
      s.cursor.col = col;
      s.dirty = true;
      break;
    }
    case 'C-u': {
      setLine(s, lineOf(s).slice(s.cursor.col));
      s.cursor.col = 0;
      s.dirty = true;
      break;
    }
    case 'up':   motionUp(s);   break;
    case 'down': motionDown(s); break;
    case 'left':
      if (s.cursor.col > 0) s.cursor.col--;
      else if (s.cursor.row > 0) { s.cursor.row--; s.cursor.col = lineOf(s).length; }
      break;
    case 'right': {
      const len = lineOf(s).length;
      if (s.cursor.col < len) s.cursor.col++;
      else if (s.cursor.row < s.lines.length - 1) { s.cursor.row++; s.cursor.col = 0; }
      break;
    }
    case 'home': motionLineStart(s); break;
    case 'end':  s.cursor.col = lineOf(s).length; break;
    default: {
      if (ch && ch.length === 1 && ch.charCodeAt(0) >= 32) {
        insertText(s, ch);
        s.dirty = true;
      }
      break;
    }
  }
  return null;
}

// ─── VISUAL mode ──────────────────────────────────────────────────────────────

function handleVisual(s, key, ch) {
  if (key === 'escape' || key === 'C-c' || key === 'v' || key === 'V') {
    s.mode = 'NORMAL'; s.visual = null; return null;
  }
  const count = s.countStr ? (parseInt(s.countStr, 10) || 1) : 1;
  s.countStr = '';

  if (/^[1-9]$/.test(ch)) { s.countStr = ch; return null; }
  if (ch === '0' && s.countStr) { s.countStr += '0'; return null; }

  // Movement keys extend selection
  const navKeys = ['h','l','j','k','left','right','up','down','w','W','b','B','e','E',
                   '0','^','$','G','gg','{','}'];
  if (navKeys.includes(key)) {
    applyMotion(s, key);
    if (!s.countStr) for (let i=1;i<count;i++) applyMotion(s, key);
    return null;
  }

  const vr = visualRange(s);

  switch (key) {
    case 'd': case 'x': {
      saveUndo(s);
      const yanked = deleteRange(s, vr.startRow, vr.startCol, vr.endRow, vr.endCol, vr.linewise);
      yankToRegister(s, yanked);
      s.mode = 'NORMAL'; s.visual = null;
      s.lastChange = { key };
      break;
    }
    case 'y': {
      yankToRegister(s, vr.text);
      s.cursor = { row: vr.startRow, col: vr.startCol };
      s.mode = 'NORMAL'; s.visual = null;
      break;
    }
    case 'c': {
      saveUndo(s);
      deleteRange(s, vr.startRow, vr.startCol, vr.endRow, vr.endCol, vr.linewise);
      s.mode = 'NORMAL'; s.visual = null;
      enterInsert(s);
      break;
    }
    case '>': {
      saveUndo(s);
      indentLines(s, vr.startRow, vr.endRow, 1);
      s.mode = 'NORMAL'; s.visual = null;
      break;
    }
    case '<': {
      saveUndo(s);
      indentLines(s, vr.startRow, vr.endRow, -1);
      s.mode = 'NORMAL'; s.visual = null;
      break;
    }
    case '~': {
      saveUndo(s);
      for (let r = vr.startRow; r <= vr.endRow; r++) {
        const sc = r === vr.startRow ? vr.startCol : 0;
        const ec = r === vr.endRow ? vr.endCol : s.lines[r].length;
        const seg = s.lines[r].slice(sc, ec);
        s.lines[r] = s.lines[r].slice(0, sc) +
          seg.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('') +
          s.lines[r].slice(ec);
      }
      s.mode = 'NORMAL'; s.visual = null;
      break;
    }
    case 'u': {
      saveUndo(s);
      for (let r = vr.startRow; r <= vr.endRow; r++)
        s.lines[r] = s.lines[r].toLowerCase();
      s.mode = 'NORMAL'; s.visual = null;
      break;
    }
    case 'U': {
      saveUndo(s);
      for (let r = vr.startRow; r <= vr.endRow; r++)
        s.lines[r] = s.lines[r].toUpperCase();
      s.mode = 'NORMAL'; s.visual = null;
      break;
    }
    default: break;
  }
  return null;
}

// ─── COMMAND mode (:) ─────────────────────────────────────────────────────────

function handleCommand(s, key, ch) {
  if (key === 'escape' || key === 'C-c') {
    s.mode = 'NORMAL'; s.commandBuf = ''; return null;
  }
  if (key === 'backspace' || key === 'C-h') {
    if (s.commandBuf.length === 0) { s.mode = 'NORMAL'; return null; }
    s.commandBuf = s.commandBuf.slice(0, -1);
    return null;
  }
  if (key === 'enter') {
    const cmd = s.commandBuf.trim();
    s.commandBuf = '';
    s.mode = 'NORMAL';
    return parseExCommand(s, cmd);
  }
  if (ch && ch.charCodeAt(0) >= 32) {
    s.commandBuf += ch;
  }
  return null;
}

function parseExCommand(s, cmd) {
  if (cmd === 'w')  return { type: 'save' };
  if (cmd === 'w!') return { type: 'save', force: true };
  if (cmd === 'q')  return { type: 'quit' };
  if (cmd === 'q!') return { type: 'quit', force: true };
  if (cmd === 'wq' || cmd === 'x' || cmd === 'wq!') return { type: 'saveAndQuit' };
  if (cmd.startsWith('e ')) return { type: 'openFile', path: cmd.slice(2).trim() };
  if (cmd.startsWith('e! ')) return { type: 'openFile', path: cmd.slice(3).trim(), force: true };
  if (cmd === 'noh' || cmd === 'nohlsearch') return { type: 'clearSearch' };
  if (cmd.startsWith('%s')) {
    const m = cmd.match(/^%s\/((?:[^/\\]|\\.)*)\/([^/]*)\/([gimc]*)/);
    if (m) return { type: 'substitute', pattern: m[1], replacement: m[2], flags: m[3] };
  }
  return { type: 'exError', message: `E492: Not an editor command: ${cmd}` };
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function searchNext(s, dir) {
  if (!s.lastSearch) return;
  const fn = dir > 0 ? searchForward : searchBackward;
  const pos = fn(s, s.lastSearch, s.cursor.row, s.cursor.col);
  if (pos) { s.cursor.row = pos.row; s.cursor.col = pos.col; }
}

export function applySearch(s, pattern, dir) {
  s.lastSearch = pattern;
  s.lastSearchDir = dir;
  searchNext(s, dir);
}

function wordUnderCursor(s) {
  const line = lineOf(s);
  const col = s.cursor.col;
  const m = line.match(/\w+/g);
  if (!m) return null;
  let offset = 0;
  for (const w of m) {
    if (offset + w.length > col) return w;
    offset += w.length;
    while (offset < line.length && !/\w/.test(line[offset])) offset++;
  }
  return null;
}

function matchBracket(s) {
  const line = lineOf(s);
  const col = s.cursor.col;
  const open = '([{', close = ')]}';
  const ch = line[col];
  const oi = open.indexOf(ch), ci = close.indexOf(ch);
  if (oi >= 0) {
    let depth = 1, r = s.cursor.row, c = col + 1;
    outer: while (r < s.lines.length) {
      while (c < s.lines[r].length) {
        if (s.lines[r][c] === open[oi]) depth++;
        if (s.lines[r][c] === close[oi]) { depth--; if (!depth) { s.cursor.row=r; s.cursor.col=c; break outer; } }
        c++;
      }
      r++; c = 0;
    }
  } else if (ci >= 0) {
    let depth = 1, r = s.cursor.row, c = col - 1;
    outer: while (r >= 0) {
      while (c >= 0) {
        if (s.lines[r][c] === close[ci]) depth++;
        if (s.lines[r][c] === open[ci]) { depth--; if (!depth) { s.cursor.row=r; s.cursor.col=c; break outer; } }
        c--;
      }
      r--; if (r >= 0) c = s.lines[r].length - 1;
    }
  }
}

function pasteAfter(s, text) {
  if (text.endsWith('\n')) {
    // linewise
    const rows = text.replace(/\n$/, '').split('\n');
    s.lines.splice(s.cursor.row + 1, 0, ...rows);
    s.cursor.row++;
    motionFirstNonBlank(s);
  } else {
    const line = lineOf(s);
    const col = Math.min(s.cursor.col + 1, line.length);
    setLine(s, line.slice(0, col) + text + line.slice(col));
    s.cursor.col = col + text.length - 1;
  }
}

function pasteBefore(s, text) {
  if (text.endsWith('\n')) {
    const rows = text.replace(/\n$/, '').split('\n');
    s.lines.splice(s.cursor.row, 0, ...rows);
    motionFirstNonBlank(s);
  } else {
    const line = lineOf(s);
    setLine(s, line.slice(0, s.cursor.col) + text + line.slice(s.cursor.col));
  }
}

function caseOpLine(s, op) {
  const line = lineOf(s);
  const fn = op === 'toggle' ? (c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())
           : op === 'lower'  ? (c => c.toLowerCase())
           : (c => c.toUpperCase());
  setLine(s, line.split('').map(fn).join(''));
}

function replayLastChange(s) {
  // Best-effort replay for simple single-key changes.
  if (!s.lastChange) return null;
  saveUndo(s);
  const { key, count = 1 } = s.lastChange;
  // Re-dispatch the stored key sequence
  for (let i = 0; i < count; i++) {
    s.countStr = '';
    s.pendingOp = null;
    if (key.length === 2 && key[0] === key[1]) {
      // doubled operator (dd, cc, yy, etc.)
      s.countStr = '1';
      handleNormal(s, key[0], key[0]);
      handlePending(s, key[1], key[1], 1);
    } else {
      handleNormal(s, key, key);
    }
  }
  return null;
}

// ─── substitute ───────────────────────────────────────────────────────────────

export function applySubstitute(s, pattern, replacement, flags) {
  saveUndo(s);
  const re = new RegExp(pattern, flags.includes('i') ? 'gi' : (flags.includes('g') ? 'g' : ''));
  for (let r = 0; r < s.lines.length; r++) {
    s.lines[r] = s.lines[r].replace(re, replacement);
  }
  clampCursor(s);
  s.dirty = true;
}
