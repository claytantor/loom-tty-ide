import blessed from 'neo-blessed';
import { activateModal, deactivateModal } from '../overlay/modal-helpers.js';

// Slash command palette. Drives selection and rendering manually so the
// behaviour doesn't depend on blessed's focus / list internals.

export function createPalette({ screen, theme, registry, onRun }) {
  let prevFocus = null;
  let visibleCmds = [];
  let pendingInput = '';
  let selectedIdx = 0;
  let keyListener = null;

  const container = blessed.box({
    parent: screen,
    top: 'center', left: 'center',
    width: '70%', height: '60%',
    border: { type: 'line' },
    label: ' Slash commands ',
    style: { fg: theme.foreground, bg: theme.background, border: { fg: theme.accent } },
    hidden: true,
    keys: false,
    mouse: false,
  });

  const input = blessed.box({
    parent: container,
    top: 0, left: 1, right: 1, height: 1,
    tags: false,
    style: { fg: theme.foreground, bg: theme.background },
  });

  const list = blessed.list({
    parent: container,
    top: 2, left: 0, right: 0, bottom: 1,
    keys: false, mouse: false, tags: false,
    style: {
      fg: theme.foreground,
      bg: theme.background,
      selected: { fg: theme.statusbar?.foreground || 'black', bg: theme.accent },
    },
    items: [],
  });

  blessed.box({
    parent: container,
    bottom: 0, left: 1, right: 1, height: 1,
    tags: false,
    content: 'Up/Down · Enter · Esc · Tab autocompletes',
    style: { fg: theme.gutter, bg: theme.background },
  });

  function rerender() {
    const { name } = registry.parse(pendingInput);
    visibleCmds = registry.filter(name);
    const items = visibleCmds.map((c) => {
      const argHint = c.argHint ? ` ${c.argHint}` : '';
      const label = `/${c.name}${argHint}`;
      const desc = c.description ? `   ${c.description}` : '';
      return label.padEnd(30, ' ') + desc;
    });
    list.setItems(items);
    if (selectedIdx >= items.length) selectedIdx = Math.max(0, items.length - 1);
    if (selectedIdx < 0) selectedIdx = 0;
    list.select(selectedIdx);
    input.setContent('/' + pendingInput.replace(/^\//, ''));
    screen.render();
  }

  function moveSel(delta) {
    if (!visibleCmds.length) return;
    selectedIdx = Math.max(0, Math.min(visibleCmds.length - 1, selectedIdx + delta));
    list.select(selectedIdx);
    screen.render();
  }

  function submit() {
    const { name, args } = registry.parse(pendingInput);
    const exact = registry.find(name);
    const chosen = exact || visibleCmds[selectedIdx];
    hide();
    if (chosen) onRun?.(chosen, args);
  }

  // Single screen-level listener handles every key while the palette is up.
  // Built before show() so it's cheap to attach/detach.
  // The keyListener is responsible only for filling the filter buffer with
  // typed characters (and Ctrl-U to clear). Navigation, Enter, Esc, Tab,
  // and Backspace go through the screen.key bindings above so we don't
  // double-handle those events.
  const NAV_NAMES = new Set([
    'up', 'down', 'left', 'right', 'pageup', 'pagedown', 'home', 'end',
    'enter', 'return', 'escape', 'tab', 'backspace', 'delete',
  ]);
  function makeListener() {
    return (ch, key) => {
      if (!container.visible) return;
      const name = (key && key.name) || '';
      if (NAV_NAMES.has(name)) return;

      if (key && key.ctrl) {
        if (name === 'u') { pendingInput = ''; rerender(); return; }
        if (name === 'c') { hide(); return; }
        return;
      }

      if (ch && ch.length === 1) {
        const code = ch.charCodeAt(0);
        if (code >= 32 && code !== 127) {
          pendingInput += ch;
          rerender();
        }
      }
    };
  }

  // Also bind nav keys via screen.key — this fires `key X` events which are
  // a separate path from screen.on('keypress'). Belt-and-suspenders so at
  // least one path works in any blessed version / terminal.
  const upHandler        = () => { if (container.visible) moveSel(-1); };
  const downHandler      = () => { if (container.visible) moveSel(1); };
  const enterHandler     = () => { if (container.visible) submit(); };
  const escapeHandler    = () => { if (container.visible) hide(); };
  const tabHandler       = () => {
    if (!container.visible) return;
    const top = visibleCmds[0];
    if (top) { pendingInput = top.name; selectedIdx = 0; rerender(); }
  };
  const pgUpHandler      = () => { if (container.visible) moveSel(-Math.max(1, Math.floor(list.height / 2))); };
  const pgDownHandler    = () => { if (container.visible) moveSel(Math.max(1, Math.floor(list.height / 2))); };
  const homeHandler      = () => { if (container.visible) { selectedIdx = 0; list.select(0); screen.render(); } };
  const endHandler       = () => { if (container.visible) { selectedIdx = Math.max(0, visibleCmds.length - 1); list.select(selectedIdx); screen.render(); } };
  const backspaceHandler = () => { if (container.visible) { pendingInput = pendingInput.slice(0, -1); rerender(); } };

  screen.key(['up'],        upHandler);
  screen.key(['down'],      downHandler);
  screen.key(['enter'],     enterHandler);
  screen.key(['escape'],    escapeHandler);
  screen.key(['tab'],       tabHandler);
  screen.key(['pageup'],    pgUpHandler);
  screen.key(['pagedown'],  pgDownHandler);
  screen.key(['home'],      homeHandler);
  screen.key(['end'],       endHandler);
  screen.key(['backspace'], backspaceHandler);

  // Register the keypress listener once at construction time. The visibility
  // check inside the listener gates it. This avoids any ordering surprises
  // around blessed's input pipeline when listeners are added inside an event
  // handler.
  keyListener = makeListener();
  screen.on('keypress', keyListener);

  function show() {
    if (container.visible) return;
    prevFocus = screen.focused;
    pendingInput = '';
    selectedIdx = 0;
    activateModal({ screen, container, focus: list });
    rerender();
    list.select(0);
    try { screen.program.showCursor(); } catch {}
  }

  function hide() {
    try { screen.program.hideCursor(); } catch {}
    deactivateModal({ screen, container, restoreFocus: prevFocus });
  }

  return { box: container, show, hide, submit };
}
