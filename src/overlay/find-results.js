import blessed from 'neo-blessed';
import path from 'node:path';
import chalk from 'chalk';
import cliTruncate from 'cli-truncate';
import stringWidth from 'string-width';
import { asArray } from '../keybindings.js';
import { activateModal, deactivateModal } from './modal-helpers.js';

// Format a single result row to fit `width` columns. Layout:
//
//   <dirname>/<basename>:<line>   │  <preview …>
//      gray    cyan    gray-yellow gray   default
//
// Paths are made relative to `rootDir` (the directory loom was launched in)
// so deeply-nested matches stay readable. Long file paths are truncated from
// the start (keeping the basename + line number visible). Long previews are
// truncated from the end. We deliberately do NOT wrap rows in OSC 8
// hyperlinks — blessed strips ESC bytes from non-SGR sequences, so the URL
// would leak as visible garbage in the modal. Enter still opens the file.
export function formatRow(r, width, rootDir) {
  const root    = rootDir || process.cwd();
  const rel     = path.relative(root, r.file);
  const dir     = path.dirname(rel);
  const base    = path.basename(rel);
  const lineNo  = String(r.line);
  // Collapse tabs and trim trailing whitespace; the preview is purely visual,
  // so internal whitespace beyond a single space adds nothing readable.
  const preview = r.preview.replace(/\t/g, '  ').replace(/\s+$/, '').trim();

  // Plain (uncoloured) version used to compute widths.
  const dirSlash    = dir === '.' ? '' : dir + '/';
  const fileLine    = `${dirSlash}${base}:${lineNo}`;
  const fileColMax  = Math.max(20, Math.floor(width * 0.45));
  const sep         = '  │  ';
  const sepW        = stringWidth(sep);

  let fileDisplay;        // plain string for width math
  let fileColored;        // colored string actually rendered

  const fw = stringWidth(fileLine);
  if (fw > fileColMax) {
    // Drop characters from the front; keep tail (basename + line). The
    // ellipsis signals the path was clipped.
    const ellipsis = '…';
    const keep     = fileLine.slice(fw - fileColMax + 1);
    fileDisplay    = ellipsis + keep;
    fileColored    = chalk.gray(ellipsis) + chalk.cyan(keep.replace(`:${lineNo}`, '')) + chalk.gray(':') + chalk.yellow(lineNo);
  } else {
    fileDisplay = fileLine.padEnd(fileColMax, ' ');
    const dirPart  = dirSlash ? chalk.gray(dirSlash) : '';
    const padding  = ' '.repeat(fileColMax - fw);
    fileColored    = dirPart + chalk.cyan(base) + chalk.gray(':') + chalk.yellow(lineNo) + padding;
  }

  const previewW    = Math.max(1, width - stringWidth(fileDisplay) - sepW);
  const previewTrim = cliTruncate(preview, previewW, { position: 'end' });

  return fileColored + chalk.gray(sep) + previewTrim;
}

const DEFAULT_KEYS = {
  down:     ['j', 'down'],
  up:       ['k', 'up'],
  open:     'enter',
  top:      ['g', 'home'],
  bottom:   ['S-g', 'end'],
  pageDown: ['C-d', 'pagedown'],
  pageUp:   ['C-u', 'pageup'],
  exit:     'escape',
};

export function createFindResults({ screen, theme, cwd, keybindings = {}, onOpen, onClose }) {
  const k = { ...DEFAULT_KEYS, ...keybindings };
  const rootDir = cwd || process.cwd();
  let items = [];

  const container = blessed.box({
    parent: screen,
    top: 'center', left: 'center',
    width: '90%', height: '70%',
    border: { type: 'line' },
    label: ' Find results ',
    style: { fg: theme.foreground, bg: theme.background, border: { fg: theme.accent } },
    hidden: true,
  });

  const list = blessed.list({
    parent: container,
    top: 0, left: 0, right: 0, bottom: 0,
    keys: false, mouse: false,
    tags: false,
    style: {
      fg: theme.foreground, bg: theme.background,
      selected: { fg: theme.statusbar?.foreground || 'black', bg: theme.accent },
    },
    items: [],
  });

  // Inner width available to a single row. Falls back to 80 when blessed
  // hasn't laid out yet.
  function rowWidth() {
    const w = list.width || (container.width - 2) || (screen.width * 0.9 - 2) || 80;
    return Math.max(20, w - 2); // -2 for safety margin
  }

  function rerender() {
    if (!items.length) return;
    const w = rowWidth();
    list.setItems(items.map((r) => formatRow(r, w, rootDir)));
  }

  // Re-truncate rows on terminal resize.
  screen.on('resize', () => { if (container.visible) { rerender(); screen.render(); } });

  function whenVisible(fn) {
    return (...args) => { if (container.visible) fn(...args); };
  }
  screen.key(asArray(k.down),     whenVisible(() => { list.down(1); screen.render(); }));
  screen.key(asArray(k.up),       whenVisible(() => { list.up(1); screen.render(); }));
  screen.key(asArray(k.top),      whenVisible(() => { list.select(0); screen.render(); }));
  screen.key(asArray(k.bottom),   whenVisible(() => { list.select(Math.max(0, items.length - 1)); screen.render(); }));
  screen.key(asArray(k.pageDown), whenVisible(() => { list.down(Math.max(1, Math.floor(list.height / 2))); screen.render(); }));
  screen.key(asArray(k.pageUp),   whenVisible(() => { list.up(Math.max(1, Math.floor(list.height / 2))); screen.render(); }));
  screen.key(asArray(k.open), whenVisible(() => {
    const it = items[list.selected];
    if (!it) return;
    hide();
    onOpen?.(it);
  }));
  screen.key(asArray(k.exit), whenVisible(() => hide()));

  let prevFocus = null;

  function show(results) {
    items = results;
    const w = rowWidth();
    const rendered = items.length
      ? items.map((r) => formatRow(r, w, rootDir))
      : [chalk.gray('  no matches')];
    container.setLabel(` Find results — ${items.length} match${items.length === 1 ? '' : 'es'} `);
    if (container.visible) {
      list.setItems(rendered);
      list.select(0);
      screen.render();
      return;
    }
    prevFocus = screen.focused;
    list.setItems(rendered);
    activateModal({ screen, container, focus: list });
    list.select(0);
    list.focus();
    // Re-render once layout is final — rowWidth() may have been a fallback.
    setImmediate(() => { rerender(); screen.render(); });
    screen.render();
  }
  function hide() {
    deactivateModal({ screen, container, restoreFocus: prevFocus });
    onClose?.();
  }
  return { box: container, show, hide };
}
