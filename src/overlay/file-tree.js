import blessed from 'neo-blessed';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildTree, filterTree, formatRow } from './tree-model.js';
import { asArray } from '../keybindings.js';
import { activateModal, deactivateModal } from './modal-helpers.js';

// True when `dir` is strictly inside the user's HOME directory (not HOME itself).
export function isSubdirOfHome(dir, home = os.homedir()) {
  const norm = (p) => path.resolve(p);
  const d = norm(dir);
  const h = norm(home);
  if (d === h) return false;
  return d.startsWith(h + path.sep);
}

const DEFAULT_KEYS = {
  down:     ['j', 'down'],
  up:       ['k', 'up'],
  expand:   ['l', 'right'],
  collapse: ['h', 'left'],
  open:     'enter',
  top:      ['g', 'home'],
  bottom:   ['S-g', 'end'],
  pageDown: ['C-d', 'pagedown'],
  pageUp:   ['C-u', 'pageup'],
  filter:   '/',
  exit:     'escape',
};

export function createFileTree({ screen, theme, cwd, config, gitStatus,
                                 keybindings = {}, onOpen, onReroot, onClose }) {
  const k = { ...DEFAULT_KEYS, ...keybindings };
  const originalRoot = cwd;
  let currentRoot = cwd;
  const expanded = new Set();
  let filterQuery = '';
  let filtering = false;
  let visibleLines = [];

  const container = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '60%',
    height: '80%',
    border: { type: 'line' },
    style: { fg: theme.foreground, bg: theme.background, border: { fg: theme.accent } },
    label: ' Files ',
    hidden: true,
    keys: false,
    mouse: false,
  });

  const list = blessed.list({
    parent: container,
    top: 0,
    left: 0,
    right: 0,
    bottom: 1,
    keys: false,
    mouse: false,
    tags: false,
    style: {
      fg: theme.foreground,
      bg: theme.background,
      selected: { fg: theme.statusbar?.foreground || 'black', bg: theme.accent },
    },
    items: [],
  });

  const filterInput = blessed.textbox({
    parent: container,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    inputOnFocus: true,
    style: { fg: theme.foreground, bg: theme.background },
    hidden: true,
  });

  function rebuild() {
    const showParent = isSubdirOfHome(currentRoot);
    const parentPath = showParent ? path.dirname(currentRoot) : null;
    const all = buildTree(currentRoot, config.ignore, expanded, {
      parentNav: showParent,
      parentPath,
    });
    visibleLines = filtering ? filterTree(all, filterQuery) : all;
    const statusMap = gitStatus?.snapshot?.() || new Map();
    const rows = visibleLines.map((l) => {
      if (l.isParent) return formatRow(l);
      const rel = path.relative(currentRoot, l.path);
      const flag = statusMap.get(rel) || '';
      return formatRow(l, flag);
    });
    list.setItems(rows);
    if (list.selected >= rows.length) list.select(Math.max(0, rows.length - 1));
    container.setLabel(filtering
      ? ` Files (filter: ${filterQuery}) `
      : ` Files — ${displayPath(currentRoot)} `);
    screen.render();
  }

  function displayPath(p) {
    const home = os.homedir();
    if (p === home) return '~';
    if (p.startsWith(home + path.sep)) return '~' + p.slice(home.length);
    return p;
  }

  function selectedLine() {
    return visibleLines[list.selected];
  }

  function expandOrOpen() {
    const line = selectedLine();
    if (!line) return;
    if (line.isParent) {
      // Treat parent (..) as a re-root operation: navigate up.
      rerootTo(line.path);
      return;
    }
    if (line.isDir) {
      if (expanded.has(line.path)) expanded.delete(line.path); else expanded.add(line.path);
      rebuild();
    } else {
      hide();
      onOpen?.(line.path);
    }
  }

  function rerootTo(newRoot) {
    currentRoot = newRoot;
    expanded.clear();
    list.select(0);
    onReroot?.(currentRoot);
    rebuild();
  }

  function collapseOrParent() {
    const line = selectedLine();
    if (!line) return;
    if (line.isDir && expanded.has(line.path)) {
      expanded.delete(line.path);
      rebuild();
      return;
    }
    // Move selection to nearest ancestor.
    const parentPath = path.dirname(line.path);
    if (parentPath === currentRoot) return;
    const idx = visibleLines.findIndex((l) => l.path === parentPath);
    if (idx >= 0) list.select(idx);
    screen.render();
  }

  function reroot() {
    const line = selectedLine();
    if (!line) return;
    if (line.isParent) { rerootTo(line.path); return; }
    if (line.isDir) {
      // Enter on a regular directory now expands/collapses (matches `l`),
      // so the launch directory always stays the top of the tree. Use
      // `..` at the top to navigate upward.
      if (expanded.has(line.path)) expanded.delete(line.path); else expanded.add(line.path);
      rebuild();
      return;
    }
    hide();
    onOpen?.(line.path);
  }

  function startFilter() {
    filtering = true;
    filterQuery = '';
    filterInput.show();
    filterInput.setValue('/');
    container.setLabel(' Files (filter) ');
    rebuild();
    filterInput.readInput((err, value) => {
      filterInput.hide();
      filterQuery = (value || '').replace(/^\//, '');
      filtering = !!filterQuery;
      container.setLabel(filtering ? ` Files (filter: ${filterQuery}) ` : ' Files ');
      rebuild();
      list.focus();
    });
    screen.render();
  }

  function clearFilter() {
    filtering = false;
    filterQuery = '';
    container.setLabel(' Files ');
    rebuild();
  }

  // Bind at the screen level (not the list level) — screen.key fires on
  // screen.emit('key X'), which doesn't depend on the list being keyable
  // or focused. Each handler short-circuits when the file tree is hidden.
  function whenVisible(fn) {
    return (...args) => { if (container.visible) fn(...args); };
  }
  screen.key(asArray(k.down),     whenVisible(() => { list.down(1); screen.render(); }));
  screen.key(asArray(k.up),       whenVisible(() => { list.up(1); screen.render(); }));
  screen.key(asArray(k.top),      whenVisible(() => { list.select(0); screen.render(); }));
  screen.key(asArray(k.bottom),   whenVisible(() => { list.select(Math.max(0, visibleLines.length - 1)); screen.render(); }));
  screen.key(asArray(k.pageDown), whenVisible(() => { list.down(Math.max(1, Math.floor(list.height / 2))); screen.render(); }));
  screen.key(asArray(k.pageUp),   whenVisible(() => { list.up(Math.max(1, Math.floor(list.height / 2))); screen.render(); }));
  screen.key(asArray(k.expand),   whenVisible(expandOrOpen));
  screen.key(asArray(k.collapse), whenVisible(collapseOrParent));
  screen.key(asArray(k.open),     whenVisible(reroot));
  screen.key(asArray(k.filter),   whenVisible(startFilter));
  screen.key(asArray(k.exit),     whenVisible(() => {
    if (filtering) { clearFilter(); return; }
    hide();
  }));

  let prevFocus = null;

  function show() {
    if (container.visible) return;
    prevFocus = screen.focused;
    // Always reset the top-level root to the directory loom was launched
    // from. Within a session the user can navigate up via `..` and down
    // via expand/collapse, but reopening the tree returns home.
    currentRoot = originalRoot;
    expanded.clear();
    filterQuery = '';
    filtering = false;
    activateModal({ screen, container, focus: list });
    rebuild();
    list.select(0);
    list.focus();   // re-focus after rebuild (setItems can swallow focus state)
    screen.render();
  }
  function hide() {
    deactivateModal({ screen, container, restoreFocus: prevFocus });
    onClose?.();
  }
  function toggle() { container.visible ? hide() : show(); }

  // Reset session state at start: ensure currentRoot starts at originalRoot.
  currentRoot = originalRoot;

  return { box: container, show, hide, toggle, rebuild };
}
