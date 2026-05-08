import blessed from 'neo-blessed';
import fs from 'node:fs';
import path from 'node:path';
import { createState, handleKey, getText, setText, applySearch, applySubstitute } from './vim.js';
import { renderLines } from './cursor-render.js';
import { runFormat } from './lint.js';
import { buildSplash } from '../ui/splash.js';

export function createEditorPane({ parent, screen, theme, config, lsp, onDirtyChange, onModeChange, onFileChange, onCursorChange, onSave }) {

  // ── layout ──────────────────────────────────────────────────────────────────
  const wrap = blessed.box({
    parent,
    top: 0, left: 0, right: 0, bottom: 0,
    style: { fg: theme.foreground, bg: theme.background },
    border: { type: 'line' },
  });
  wrap.style.border = { fg: theme.gutter };

  // Single view for both NORMAL and INSERT — no textarea.
  const view = blessed.box({
    parent: wrap,
    top: 0, left: 0, right: 0, bottom: 0,
    tags: false,
    scrollable: true,
    alwaysScroll: true,
    keys: false,
    mouse: false,
    style: { fg: theme.foreground, bg: theme.background },
  });

  // Tiny command-mode bar at bottom (shows ":<buf>")
  const cmdBar = blessed.box({
    parent: wrap,
    bottom: 0, left: 0, right: 0, height: 1,
    tags: false,
    hidden: true,
    style: { fg: theme.foreground, bg: theme.background },
  });

  // ── state ───────────────────────────────────────────────────────────────────
  let filePath  = null;
  let vim       = createState('');
  let scroll    = 0;           // first visible row index
  let hlLine    = -1;          // transient jump highlight
  let hlTimer   = null;
  let diagnostics = [];
  let searchPromptActive = false;

  // ── render ───────────────────────────────────────────────────────────────────
  function render() {
    if (!filePath) {
      view.setContent(buildSplash(innerWidth(), innerHeight()));
      cmdBar.hide();
      screen.render();
      return;
    }

    // Keep scroll so cursor is always visible.
    const h  = innerHeight();
    if (vim.cursor.row < scroll)           scroll = vim.cursor.row;
    if (vim.cursor.row >= scroll + h)      scroll = vim.cursor.row - h + 1;
    scroll = Math.max(0, scroll);

    const visLines = vim.lines.slice(scroll, scroll + h);
    const adjCursor = { row: vim.cursor.row - scroll, col: vim.cursor.col };

    const content = renderLines({
      lines:         visLines,
      cursor:        adjCursor,
      mode:          vim.mode,
      visual:        vim.visual ? { row: vim.visual.row - scroll, col: vim.visual.col } : null,
      filePath,
      theme,
      config,
      diagnostics,
      highlightLine: hlLine >= 0 ? hlLine - scroll : -1,
      scroll,
      viewHeight:    h,
      viewWidth:     innerWidth(),
    });

    view.setContent(content);

    // Command bar
    if (vim.mode === 'COMMAND') {
      cmdBar.setContent(':' + vim.commandBuf);
      cmdBar.show();
    } else {
      cmdBar.hide();
    }

    // Cursor visibility
    try {
      if (vim.mode === 'INSERT') screen.program.showCursor();
      else screen.program.hideCursor();
    } catch {}

    onCursorChange?.({
      row: vim.cursor.row,
      col: vim.cursor.col,
      total: vim.lines.length,
    });
    screen.render();
  }

  let errorTimer = null;
  function showError(msg) {
    cmdBar.setContent(msg);
    cmdBar.show();
    screen.render();
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => { cmdBar.hide(); screen.render(); }, 3000);
  }

  function innerHeight() {
    // Subtract 1 for border on each side, command bar when active.
    const extra = vim.mode === 'COMMAND' ? 1 : 0;
    return Math.max(1, (view.height || 24) - extra);
  }
  function innerWidth() { return Math.max(20, (view.width || 80) - 2); }

  // ── file operations ───────────────────────────────────────────────────────
  function openFile(fp) {
    let text;
    try { text = fs.readFileSync(fp, 'utf8'); }
    catch (err) { text = `(error reading file: ${err.message})`; }
    filePath = fp;
    vim = createState(text);
    scroll = 0; diagnostics = [];
    if (lsp) {
      lsp.didOpen(fp, text, null);
      lsp.onDiagnostics(fp, (d) => { diagnostics = d; render(); });
    }
    onDirtyChange?.(false);
    onModeChange?.(vim.mode);
    render();
  }

  function openAt(fp, line) {
    if (filePath !== fp) { openFile(fp); }
    vim.cursor.row = Math.max(0, line - 1);
    vim.cursor.col = 0;
    const h = innerHeight();
    scroll = Math.max(0, vim.cursor.row - Math.floor(h / 2));
    hlLine = vim.cursor.row;
    clearTimeout(hlTimer);
    hlTimer = setTimeout(() => { hlLine = -1; render(); }, 1500);
    render();
  }

  function save() {
    if (!filePath) return;
    try { fs.writeFileSync(filePath, getText(vim)); }
    catch (err) { /* TODO: show error */ return; }
    vim.dirty = false;
    onDirtyChange?.(false);
    onSave?.(filePath);
    render();
  }

  async function format() {
    if (!filePath) return;
    if (vim.dirty) save();
    const r = await runFormat(filePath);
    if (r.ok) openFile(filePath);
    return r;
  }

  function appendStreaming(chunk) {
    if (!filePath) return;
    const text = getText(vim) + chunk;
    setText(vim, text);
    vim.dirty = true;
    vim.cursor.row = vim.lines.length - 1;
    vim.cursor.col = Math.max(0, vim.lines[vim.cursor.row].length - 1);
    scroll = Math.max(0, vim.cursor.row - innerHeight() + 2);
    onDirtyChange?.(true);
    render();
  }

  // ── key handling ─────────────────────────────────────────────────────────
  view.on('keypress', (ch, key) => {
    if (searchPromptActive) return;
    // No file open ⇒ splash screen ⇒ ignore all keys here. The slash palette
    // and global keybindings handle them at the screen level. Without this
    // guard, vim's `/` would fire promptSearch (a blessed textbox readInput)
    // simultaneously with the palette opening, leaving screen.grabKeys
    // sticky until the orphan textbox is Esc'd out.
    if (!filePath) return;
    // Scratch buffers ([ai-response], [blame], [diff]) allow vim navigation
    // but never the readInput-based search prompt — that would race with
    // any overlay above them (palette, etc.).
    const isScratch = filePath.startsWith('[');
    if (isScratch && (ch === '/' || ch === '?' || key?.full === '/' || key?.full === '?')) return;
    const keyFull = key?.full ?? ch ?? '';
    const prevMode = vim.mode;
    const prevDirty = vim.dirty;

    const action = handleKey(vim, keyFull, ch);

    if (vim.mode !== prevMode) onModeChange?.(vim.mode);
    if (vim.dirty !== prevDirty && vim.dirty) onDirtyChange?.(true);
    if (!vim.dirty && prevDirty) onDirtyChange?.(false);

    if (action) handleAction(action);
    else render();
  });

  function closeFile(force = false) {
    if (vim.dirty && !force) {
      showError('E37: No write since last change (use :q! to override)');
      return;
    }
    filePath = null;
    vim = createState('');
    scroll = 0;
    diagnostics = [];
    onDirtyChange?.(false);
    onModeChange?.('NORMAL');
    onFileChange?.(null);
    render();
  }

  function handleAction(a) {
    switch (a.type) {
      case 'save':        save(); break;
      case 'quit':        closeFile(a.force ?? false); break;
      case 'saveAndQuit': save(); closeFile(true); break;
      case 'openFile':    if (a.path) openFile(path.resolve(path.dirname(filePath || '.'), a.path)); break;
      case 'clearSearch': vim.lastSearch = ''; render(); break;
      case 'substitute':  applySubstitute(vim, a.pattern, a.replacement, a.flags); render(); break;
      case 'exError':     /* TODO: show in status */ render(); break;
      case 'promptSearch': promptSearch(a.dir); break;
      case 'scroll':       doScroll(a); break;
      case 'screenMotion': doScreenMotion(a); break;
      case 'centerCursor': case 'scrollToCursor': doScrollAlign(a); break;
    }
  }

  function doScroll(a) {
    const h = innerHeight();
    const amount = a.half ? Math.max(1, Math.floor(h / 2)) : (a.lines ?? 3);
    scroll = Math.max(0, Math.min(vim.lines.length - 1, scroll + a.dir * amount));
    if (!a.lines) {
      // also move cursor
      vim.cursor.row = Math.max(scroll, Math.min(scroll + h - 1, vim.cursor.row + a.dir * amount));
    }
    render();
  }

  function doScreenMotion(a) {
    const h = innerHeight();
    if (a.pos === 'top')  vim.cursor.row = scroll + Math.max(0, (a.count || 1) - 1);
    if (a.pos === 'mid')  vim.cursor.row = scroll + Math.floor(h / 2);
    if (a.pos === 'bot')  vim.cursor.row = scroll + h - Math.max(1, a.count || 1);
    vim.cursor.row = Math.max(0, Math.min(vim.lines.length - 1, vim.cursor.row));
    render();
  }

  function doScrollAlign(a) {
    const h = innerHeight();
    if (a.type === 'centerCursor' || a.align === 'mid')
      scroll = Math.max(0, vim.cursor.row - Math.floor(h / 2));
    else if (a.align === 'top')
      scroll = vim.cursor.row;
    else
      scroll = Math.max(0, vim.cursor.row - h + 1);
    render();
  }

  // ── search prompt (/) ─────────────────────────────────────────────────────
  function promptSearch(dir) {
    searchPromptActive = true;
    const prompt = blessed.textbox({
      parent: wrap,
      bottom: 0, left: 0, right: 0, height: 1,
      inputOnFocus: true,
      style: { fg: theme.foreground, bg: theme.background },
    });
    prompt.setValue(dir > 0 ? '/' : '?');
    prompt.focus();
    try { screen.program.showCursor(); } catch {}
    prompt.readInput((_err, val) => {
      prompt.detach();
      searchPromptActive = false;
      try { screen.program.hideCursor(); } catch {}
      view.focus();
      const pattern = (val || '').replace(/^[/?]/, '');
      if (pattern) applySearch(vim, pattern, dir);
      render();
    });
    screen.render();
  }

  // ── focus / active ────────────────────────────────────────────────────────
  function focus() { view.focus(); }
  function setActive(active) {
    wrap.style.border.fg = active ? theme.accent : theme.gutter;
    screen.render();
  }
  function dispose() {
    if (filePath && lsp) lsp.didClose(filePath);
    wrap.detach();
  }

  function openScratch(name) {
    filePath = `[${name}]`;
    vim = createState('');
    scroll = 0;
    render();
  }

  render();

  return {
    box:    wrap,
    get state() {
      return {
        file: filePath,
        dirty: vim.dirty,
        mode: vim.mode,
      };
    },
    openFile,
    openAt,
    save,
    appendStreaming,
    format,
    focus,
    setActive,
    dispose,
    rerender: render,
    openScratch,
  };
}
