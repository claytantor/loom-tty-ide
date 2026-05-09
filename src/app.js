import blessed from 'neo-blessed';
import path from 'node:path';
import { createStatusBar } from './ui/statusbar.js';
import { createFileTree } from './overlay/file-tree.js';
import { createFindResults } from './overlay/find-results.js';
import { createCheatSheet } from './overlay/cheat-sheet.js';
import { createBufferManager } from './editor/buffers.js';
import { findInFiles } from './search/find-in-files.js';
import { GitStatus } from './git/status.js';
import { blame as gitBlame } from './git/blame.js';
import { diff as gitDiff } from './git/diff.js';
import { LspManager } from './lsp/manager.js';
import { loadKeybindings, asArray } from './keybindings.js';
import { createRegistry } from './slash/registry.js';
import { createPalette } from './slash/palette.js';
import { loadTheme } from './theme.js';

export async function startApp({ cwd, config, theme }) {
  const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    mouse: false,
    title: 'loom',
    cursor: { artificial: false, blink: true, shape: 'block' },
    warnings: false,
  });

  const keybindings = loadKeybindings();

  // Make Ctrl-K and the global quit keys bypass blessed's grabKeys (set by
  // any active textbox/textarea readInput). Without this, those bindings
  // silently fail when a prompt is in-flight.
  for (const k of [
    ...asArray(keybindings.global.paletteAlt),
    ...asArray(keybindings.global.quit),
    ...asArray(keybindings.global.quitForce),
    ...asArray(keybindings.global.cheatsheet),
  ]) {
    if (k && !screen.ignoreLocked.includes(k)) screen.ignoreLocked.push(k);
  }

  // ── current mode tracking ──
  // 'none'      — splash; user can type / for the palette
  // 'edit'      — vim editor active (file open)
  // 'filetree'  — file tree overlay shown
  // 'find'      — find-results overlay shown
  // 'cheatsheet' — cheat-sheet overlay shown
  // 'palette'   — palette is the active foreground
  let mode = 'none';
  function setMode(next) {
    mode = next;
    statusbar.update({ extraMode: mode });
  }

  // ── editor area + status bar ──
  const editorArea = blessed.box({
    parent: screen, top: 0, left: 0, right: 0, bottom: 1,
    style: { fg: theme.foreground, bg: theme.background },
  });

  const statusbar = createStatusBar({ screen, theme, cwd });

  const gitStatus = new GitStatus({ cwd });
  const lsp = new LspManager({ cwd });

  const buffers = createBufferManager({
    parent: editorArea,
    screen, theme, config, cwd, statusbar, lsp,
    onDirtyChange: () => statusbar.update({ dirty: buffers.activeDirty() }),
    onModeChange: (vmode) => statusbar.update({ mode: vmode }),
    onFileChange: (file) => {
      statusbar.update({ file });
      // Going from a file → null means we're back to splash.
      if (!file && mode === 'edit') setMode('none');
      if (file && mode !== 'edit') setMode('edit');
    },
    onDiagnostics: (count) => statusbar.update({ diagnostics: count }),
    onCursorChange: (c) => statusbar.update({ cursor: c }),
    onSave: () => gitStatus.invalidate(),
  });

  // ── overlays ──
  const fileTree = createFileTree({
    screen, theme, cwd, config, gitStatus,
    keybindings: keybindings.filetree,
    onOpen: (file) => { buffers.openFile(file); /* setMode handled by onFileChange */ },
    onReroot: (newRoot) => statusbar.update({ extra: `[root: ${newRoot}]` }),
    onClose: () => { if (mode === 'filetree') setMode(buffers.hasFile() ? 'edit' : 'none'); },
  });

  const findResults = createFindResults({
    screen, theme, cwd,
    keybindings: keybindings.find,
    onOpen: ({ file, line }) => { buffers.openFileAt(file, line); },
    onClose: () => { if (mode === 'find') setMode(buffers.hasFile() ? 'edit' : 'none'); },
  });

  const cheatSheet = createCheatSheet({
    screen, theme,
    keybindings: keybindings.cheatsheet,
    onClose: () => { if (mode === 'cheatsheet') setMode(buffers.hasFile() ? 'edit' : 'none'); },
  });

  // ── slash registry & palette ──
  const registry = createRegistry();
  registerCommands();
  const palette = createPalette({
    screen, theme, registry,
    onRun: (cmd, args) => {
      try { cmd.run(args); }
      catch (err) { /* TODO: surface error in statusbar */ }
    },
  });

  // ── quit confirmation ──
  const quitConfirm = blessed.box({
    parent: screen,
    top: 'center', left: 'center',
    width: 40, height: 5,
    border: { type: 'line' },
    label: ' Quit loom? ',
    content: '\n  Quit loom? (y/n)',
    style: { fg: theme.foreground, bg: theme.background, border: { fg: theme.accent } },
    hidden: true, keys: false,
  });
  let quitting = false;
  let prevFocus = null;
  function quitNow() {
    if (quitting) return;
    quitting = true;
    lsp.shutdownAll().finally(() => { screen.destroy(); process.exit(0); });
  }
  function dismissQuit() {
    quitConfirm.hide();
    if (prevFocus && prevFocus.focus) prevFocus.focus();
    screen.render();
  }
  function askQuit() {
    if (quitConfirm.visible) return;
    prevFocus = screen.focused;
    quitConfirm.show();
    quitConfirm.setFront();
    quitConfirm.focus();
    screen.render();
  }
  quitConfirm.key([
    ...asArray(keybindings.global.yes), 'Y', 'enter',
  ], quitNow);
  quitConfirm.key([
    ...asArray(keybindings.global.no), 'N', 'escape', 'C-c', 'q',
  ], dismissQuit);

  // ── global key bindings (the only ones outside of mode contexts) ──
  // The palette opens from no-mode; quit always works.
  screen.key(asArray(keybindings.global.quit), askQuit);
  screen.key(asArray(keybindings.global.quitForce), askQuit);
  process.on('SIGINT', askQuit);
  // Alt palette trigger that works even inside a mode (if it doesn't conflict).
  screen.key(asArray(keybindings.global.paletteAlt), () => openPalette());
  // Cheatsheet shortcut from anywhere.
  screen.key(asArray(keybindings.global.cheatsheet), () => runCheatsheet());

  // ── palette trigger logic ──
  // The palette key (`/` by default) only opens the palette when no mode owns
  // the keypress. From inside a mode (edit, filetree, etc.), the mode's
  // keybindings take precedence; mode-internal `/` keeps its mode-specific
  // meaning (vim search, file-tree filter, etc.).
  screen.on('keypress', (ch, key) => {
    if (mode !== 'none') return;          // a mode owns the keypress
    if (palette.box.visible) return;      // already open
    if (quitConfirm.visible) return;
    if (!key || key.full !== keybindings.global.palette) return;
    openPalette();
  });

  function openPalette() {
    const prev = mode;
    setMode('palette');
    palette.show();
    // When the palette closes without running a command, restore prior mode.
    const restore = () => {
      if (mode === 'palette') setMode(prev);
      palette.box.removeListener('hide', restore);
    };
    palette.box.on('hide', restore);
  }

  // ── command implementations ──
  function registerCommands() {
    registry.register({
      name: 'filetree',
      description: 'Browse the project files',
      run: () => { fileTree.show(); setMode('filetree'); },
    });
    registry.register({
      name: 'edit',
      argHint: '[path]',
      description: 'Open a file for editing (no path = focus current)',
      run: (args) => {
        const target = args ? path.resolve(cwd, args) : null;
        if (target) buffers.openFile(target);
        else buffers.active().focus();
      },
    });
    registry.register({
      name: 'find',
      argHint: '[glob] <pattern>',
      description: 'Find a regex across files (e.g. `/find */*.py def` or `/find todo`)',
      run: async (args) => {
        const trimmed = (args || '').trim();
        if (!trimmed) return;
        // Multi-token form `/find <glob> <pattern>` — first whitespace-delimited
        // token is the glob (e.g. `*.py`, `foo.py`, `src/**/*.ts`); the rest is
        // the regex. Single-token form is just the regex (no glob filter).
        let glob = null, pattern = trimmed;
        const m = trimmed.match(/^(\S+)\s+(.+)$/);
        if (m) { glob = m[1]; pattern = m[2]; }
        const results = await findInFiles({ root: cwd, pattern, glob, ignore: config.ignore });
        findResults.show(results);
        setMode('find');
      },
    });
    registry.register({
      name: 'save',
      description: 'Save the current file',
      run: () => buffers.active().save(),
    });
    registry.register({
      name: 'format',
      description: 'Format the current file with prettier or ruff',
      run: () => buffers.formatActive(),
    });
    registry.register({
      name: 'blame',
      description: 'Show git blame for the current file',
      run: async () => {
        const file = buffers.active().state.file;
        if (!file || file.startsWith('[')) return;
        const lines = await gitBlame({ cwd, file });
        const text = lines.length
          ? lines.map((l) => `${l.sha.slice(0, 7)} ${l.author.padEnd(12).slice(0, 12)} | ${l.summary}`).join('\n')
          : '(no blame info)';
        const buf = buffers.openScratch('blame');
        buf.appendStreaming(text + '\n');
      },
    });
    registry.register({
      name: 'diff',
      description: 'Show git diff for the current file',
      run: async () => {
        const file = buffers.active().state.file;
        if (!file || file.startsWith('[')) return;
        const text = await gitDiff({ cwd, file });
        const buf = buffers.openScratch('diff');
        buf.appendStreaming(text);
      },
    });
    registry.register({
      name: 'split',
      argHint: 'v|h',
      description: 'Split the active pane (v=vertical, h=horizontal)',
      run: (args) => buffers.splitActive((args || 'v')[0] === 'h' ? 'h' : 'v'),
    });
    registry.register({
      name: 'close',
      description: 'Close the active split',
      run: () => buffers.closeActive(),
    });
    registry.register({
      name: 'cheatsheet',
      description: 'Show the full key tutorial',
      run: () => runCheatsheet(),
    });
    registry.register({
      name: 'help',
      description: 'Alias for /cheatsheet',
      run: () => runCheatsheet(),
    });
    registry.register({
      name: 'theme',
      argHint: '<name>',
      description: 'Switch theme (default, solarized-dark, high-contrast, ...)',
      run: (args) => {
        if (!args) return;
        const t = loadTheme(args.trim());
        // Re-paint background of editor area + statusbar; full theming requires restart.
        editorArea.style.bg = t.background;
        editorArea.style.fg = t.foreground;
        screen.render();
      },
    });
    registry.register({
      name: 'quit',
      description: 'Quit loom (asks for confirmation)',
      run: () => askQuit(),
    });
  }

  function runCheatsheet() { cheatSheet.show(); setMode('cheatsheet'); }

  // ── startup ──
  setMode('none');
  try { screen.program.hideCursor(); } catch {}
  screen.render();

  return { screen, buffers, fileTree, statusbar, palette, registry, mode: () => mode };
}
