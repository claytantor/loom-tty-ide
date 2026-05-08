import blessed from 'neo-blessed';
import path from 'node:path';
import url from 'node:url';
import terminalLink from 'terminal-link';
import { asArray } from '../keybindings.js';
import { activateModal, deactivateModal } from './modal-helpers.js';

// Format a result row. Terminals that support OSC 8 hyperlinks (Gnome
// Terminal, iTerm2, kitty, etc.) get a clickable file:// URL; others see
// the same plain text.
function formatRow(r) {
  const rel = path.relative(process.cwd(), r.file);
  const label = `${rel}:${r.line}: ${r.preview.trim()}`;
  const target = url.pathToFileURL(r.file).href + `#L${r.line}`;
  return terminalLink(label, target, { fallback: () => label });
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

export function createFindResults({ screen, theme, keybindings = {}, onOpen, onClose }) {
  const k = { ...DEFAULT_KEYS, ...keybindings };
  let items = [];

  const container = blessed.box({
    parent: screen,
    top: 'center', left: 'center',
    width: '80%', height: '70%',
    border: { type: 'line' },
    label: ' Find results ',
    style: { fg: theme.foreground, bg: theme.background, border: { fg: theme.accent } },
    hidden: true,
  });

  const list = blessed.list({
    parent: container,
    top: 0, left: 0, right: 0, bottom: 0,
    keys: false, mouse: false,
    style: {
      fg: theme.foreground, bg: theme.background,
      selected: { fg: theme.statusbar?.foreground || 'black', bg: theme.accent },
    },
    items: [],
  });

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
    const rendered = items.map(formatRow);
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
    screen.render();
  }
  function hide() {
    deactivateModal({ screen, container, restoreFocus: prevFocus });
    onClose?.();
  }
  return { box: container, show, hide };
}
