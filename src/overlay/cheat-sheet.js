import blessed from 'neo-blessed';

export const CHEAT_SHEET = `loom — cheat sheet

Welcome. loom is organised around slash commands. From the splash screen
type \`/\` to open the command palette; pick a command to enter that mode.
Inside a mode, the mode's own keybindings drive the experience. Press
Esc to exit a mode and return to the splash. Customise everything in
~/.loom/keybindings.yml.

Scroll this cheat sheet with arrow keys, j/k, Space/PageDown, b/PageUp.
Esc or q to close.


─── First five minutes ───────────────────────────────────────────────────────

  1. /                     From the splash screen, opens the command palette.
                           Type to filter, Enter to run the highlighted
                           command, Esc to cancel.
  2. /filetree             Open the file tree. Use j/k or arrow keys to move,
                           l/Right to expand a directory, Enter on a file to
                           open it, Enter on a directory to re-root the tree.
  3. /edit some/file.js    Open the file directly for editing.
                           In the file tree, \`..\` at the top (when you're in
                           a subdirectory of \$HOME) navigates upward.
  4. i                     (inside edit mode) enter vim INSERT and start
                           typing. Esc returns to NORMAL.
  5. :w  /  :wq            Save (and close back to splash).
  6. Ctrl-Q  /  Ctrl-C     Quit loom (asks first).


─── Slash commands ───────────────────────────────────────────────────────────

  /filetree                Browse files (enters filetree mode).
  /edit [path]             Open a file (enters edit / vim mode).
  /find [glob] <regex>     Search across files; glob filters which files
                           are searched (e.g. \`*.py\`, \`foo.py\`,
                           \`src/**/*.ts\`). Without a glob, all files
                           outside \`config.ignore\` are searched.
  /ai [prompt]             Stream an AI response into a scratch buffer.
  /save                    Save the active file.
  /format                  Run prettier/ruff on the active file.
  /blame                   Git blame the active file in a scratch buffer.
  /diff                    Git diff the active file in a scratch buffer.
  /split v|h               Split the editor pane (vertical or horizontal).
  /close                   Close the active split.
  /theme <name>            Switch theme (default | solarized-dark | …).
  /cheatsheet  /help       Show this cheat sheet.
  /quit                    Quit loom (asks for confirmation).
  Ctrl-G  then  b          Show 'git blame' for the active file.
  Ctrl-G  then  d          Show 'git diff' for the active file.
  Ctrl-Q                   Quit (asks first).
  Ctrl-C                   Quit (asks first). Always works, even from prompts.
  F1                       This cheat sheet.
  ?                        Same as F1.


─── Edit mode (vim) ──────────────────────────────────────────────────────────

  Edit mode uses full vim bindings — only the meta keys (save, quit) are
  configurable in keybindings.yml under \`edit\`. Highlights:

  Modes:
    i / I / a / A           Enter INSERT (cursor / line start / after / line end)
    o / O                   Open new line below / above
    Esc                     Back to NORMAL
    v / V                   Visual character / linewise mode

  Motion (NORMAL):
    h j k l (or arrows)     Cursor
    w b e / W B E           Words (W/B/E ignore punctuation)
    0 ^ $ g_                Line start / first non-blank / line end
    gg G  :NN               Top / bottom / go to line NN
    H M L                   Top / middle / bottom of screen
    Ctrl-D / Ctrl-U         Half-page down / up
    f<c> F<c> t<c> T<c>     Find char on line; ; , repeat
    %                       Matching bracket

  Operators (NORMAL):
    d c y                   Delete / change / yank — combine with a motion
    dd cc yy                Whole line
    D C Y                   To end of line
    x X                     Delete char / before
    p P                     Paste after / before
    r<c>                    Replace char
    > <  >> <<              Indent / de-indent (count or motion)
    J                       Join lines
    ~                       Toggle case
    u  Ctrl-R               Undo / redo
    .                       Repeat last change

  Search:
    / ?  n N  * #           Forward / backward / next / prev / word

  Ex commands:
    :w                      Save the file
    :wq  :x                 Save and close back to splash (no quit)
    :q                      Close back to splash (errors if dirty)
    :q!                     Close, discarding changes
    :%s/old/new/g           Substitute
    :e <path>               Open another file
    :set nu / :set nonu     Show / hide line numbers (or :set nu! to toggle)

  Display:
    F2  /  Ctrl-N           Toggle the line-number gutter (so terminal
                            text-selection picks up only source code).

  Splits via slash commands:
    /split v   /split h     Split vertically / horizontally
    /close                  Close the active split


─── File tree (when open) ────────────────────────────────────────────────────

  j   /   Down              Move down.
  k   /   Up                Move up.
  l   /   Right             Expand directory, or open file.
  h   /   Left              Collapse directory, or jump to parent.
  Enter                     On directory: re-root the tree at this dir.
                            On file: open it in the editor.
  /                         Start a fuzzy filename filter. Type, then Enter.
  Esc                       Close filter, or close overlay if no filter.
  g   /   Home              Jump to the top.
  G   /   End               Jump to the bottom.
  Ctrl-D  /  PageDown       Page down.
  Ctrl-U  /  PageUp         Page up.

  About re-rooting: when you press Enter on a directory the tree resets to
  start at that directory. The status bar shows the new root. The original
  root is restored on the next launch.


─── Find mode (results overlay) ──────────────────────────────────────────────

  Trigger:                  /find [glob] <regex>

    /find def                  search every file for /def/
    /find *.py def             search only Python files
    /find foo.py hello         search only files literally named foo.py
    /find src/**/*.ts ^export  search every .ts in src/ at any depth

  When two whitespace-separated tokens are given, the first is the glob
  filter and the second onward is the regex. With one token, no glob
  filter is applied.

  j/k or Up/Down            Move through results.
  Enter                     Jump to that file at that line; the line is
                            briefly highlighted so you can see where you
                            landed.
  Esc                       Close.

  loom uses ripgrep when 'rg' is on PATH; otherwise it falls back to a JS
  walker that respects the 'ignore:' list in your config.


─── AI ────────────────────────────────────────────────────────────────────────

  /ai <prompt>              Send a prompt directly; response streams into a
                            scratch buffer.
  /ai                       Open the prompt overlay (type, Enter to send).

  Provider is set in ~/.loom/config.yml under 'ai.provider'. Anthropic is
  fully wired (streams via SSE); openai and ollama are stubs.


─── Git ──────────────────────────────────────────────────────────────────────

  In the file tree, modified/added/deleted/untracked files show a flag like
  [M] or [?] next to the name. Use \`/blame\` and \`/diff\` for the active file.


─── Selection & copy-paste ───────────────────────────────────────────────────

  loom never enables mouse capture, so your terminal's native selection
  works in every pane and overlay. In Gnome Terminal: shift-drag to select,
  Shift-Ctrl-C to copy. Hit F2 (or Ctrl-N, or :set nu!) to hide the
  line-number gutter so the selection picks up only the source code; the
  default value comes from editor.showLineNumbers in config.yml.

  loom uses the alternate screen, so terminal scrollback is suspended while
  loom is running. Use the editor scroll keys above instead.


─── Config & key bindings ────────────────────────────────────────────────────

  ~/.loom/config.yml             Main config. Theme, editor settings,
                                 ignore list, AI provider.
  ~/.loom/themes/<name>.yml      User themes. Shadow bundled themes with the
                                 same name.
  ~/.loom/keybindings.yml        Per-mode key overrides. Only the keys you
                                 specify are overridden; everything else
                                 falls through to the defaults.
  LOOM_HOME                      Override ~/.loom/ entirely.

  Example keybindings.yml:

      filetree:
        down: down            # use the down arrow instead of j
        up:   up
      global:
        palette: C-space      # remap the palette trigger

  API keys are read from the env var named in 'apiKeyEnv' — never stored in
  the config file.


Press Esc or q to close this cheat sheet.
`;

import { asArray } from '../keybindings.js';
import { activateModal, deactivateModal } from './modal-helpers.js';

const DEFAULT_KEYS = {
  down:     ['j', 'down'],
  up:       ['k', 'up'],
  pageDown: ['C-d', 'pagedown', 'space'],
  pageUp:   ['C-u', 'pageup', 'b'],
  top:      ['g', 'home'],
  bottom:   ['S-g', 'end'],
  exit:     ['escape', 'q'],
};

export function createCheatSheet({ screen, theme, keybindings = {}, onClose }) {
  const k = { ...DEFAULT_KEYS, ...keybindings };
  let prevFocus = null;
  const box = blessed.box({
    parent: screen,
    top: 'center', left: 'center',
    width: '90%', height: '90%',
    border: { type: 'line' },
    label: ' Cheat sheet (F1 / ?) ',
    content: CHEAT_SHEET,
    style: { fg: theme.foreground, bg: theme.background, border: { fg: theme.accent } },
    scrollable: true,
    alwaysScroll: true,
    keys: false,
    mouse: false,
    hidden: true,
    tags: false,
  });

  function whenVisible(fn) {
    return (...args) => { if (box.visible) fn(...args); };
  }
  screen.key(asArray(k.down),     whenVisible(() => { box.scroll(1); screen.render(); }));
  screen.key(asArray(k.up),       whenVisible(() => { box.scroll(-1); screen.render(); }));
  screen.key(asArray(k.pageDown), whenVisible(() => {
    box.scroll(Math.max(1, Math.floor(box.height / 2))); screen.render();
  }));
  screen.key(asArray(k.pageUp), whenVisible(() => {
    box.scroll(-Math.max(1, Math.floor(box.height / 2))); screen.render();
  }));
  screen.key(asArray(k.top),    whenVisible(() => { box.setScroll(0); screen.render(); }));
  screen.key(asArray(k.bottom), whenVisible(() => { box.setScroll(box.getScrollHeight()); screen.render(); }));
  screen.key(asArray(k.exit),   whenVisible(() => hide()));

  function show() {
    if (box.visible) return;
    prevFocus = screen.focused;
    box.setScroll(0);
    activateModal({ screen, container: box, focus: box });
  }
  function hide() {
    deactivateModal({ screen, container: box, restoreFocus: prevFocus });
    onClose?.();
  }
  function toggle() { box.visible ? hide() : show(); }

  return { box, show, hide, toggle };
}
