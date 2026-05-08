<p align="center">
  <img src="./loom.png" alt="Loom — TTY IDE" width="640" />
</p>

<h1 align="center">Loom</h1>

<p align="center">
  A neon-bright TTY IDE built to live next to an AI coding agent —<br/>
  fast over SSH, friendly with native copy-paste, configurable to the keystroke.
</p>

<p align="center">
  <a href="LICENCE.md"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-22e8ff?style=flat-square"></a>
  <img alt="Node 18+" src="https://img.shields.io/badge/node-%3E%3D18-1a90e0?style=flat-square&logo=node.js&logoColor=cffaff">
  <img alt="ESM" src="https://img.shields.io/badge/ESM-only-1a90e0?style=flat-square">
  <img alt="Tests" src="https://img.shields.io/badge/tests-152%20passing-22e8ff?style=flat-square">
  <img alt="Built with neo-blessed" src="https://img.shields.io/badge/built%20with-neo--blessed-1a90e0?style=flat-square">
  <img alt="Anthropic streaming" src="https://img.shields.io/badge/AI-Anthropic%20streaming-cffaff?style=flat-square&logo=anthropic">
  <img alt="Mouse-free" src="https://img.shields.io/badge/mouse-disabled%20on%20purpose-22e8ff?style=flat-square">
  <a href="https://github.com/claytantor/loom-tty-ide/issues"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-cffaff?style=flat-square"></a>
</p>

---

## Why Loom

Most TTY editors fight your terminal: they grab the mouse, hijack scrollback,
or hide behind tmux copy-mode. Loom does the opposite — it keeps your
terminal's own copy-paste, scroll, and clipboard intact, then layers a
modern IDE on top:

- **Slash-command paradigm.** No global key chords to memorise. Hit `/` and
  pick a capability; that capability becomes the active mode and gets its own
  keybindings, all overridable in `~/.loom/keybindings.yml`.
- **Streaming AI as a real pane.** Anthropic is wired in over native `fetch`
  + SSE — no SDKs. OpenAI and Ollama ship as stubs behind the same provider
  interface so adding a real backend is a 30-line file.
- **Full vim editor.** Modes, motions, operators, marks, ex commands,
  search/substitute, undo/redo. Save with `:w` or `Ctrl-S`; `:wq` returns to
  the splash without quitting loom.
- **First-class git, LSP, ripgrep.** Status flags decorate the file tree,
  blame and diff are slash commands, TypeScript and Python language servers
  spawn automatically when their binaries are on `$PATH`.
- **Zero ceremony to install.** A single `curl | bash` clones, installs,
  seeds your config and themes, and symlinks `loom` onto your `$PATH`.

## Quickstart

```bash
# Install (clones to ~/.loom/app, symlinks `loom` onto $PATH)
curl -fsSL https://raw.githubusercontent.com/claytantor/loom-tty-ide/main/install.sh | bash

# Set your API key (Anthropic is the only provider that ships fully wired)
export ANTHROPIC_API_KEY=sk-ant-...

# Open a project
loom .
```

Type `/` to open the command palette. Type `/cheatsheet` (or press `F1`) for
the complete tutorial. Press `Ctrl-Q` to quit.

## What it looks like

A pre-rendered preview of the splash — in your terminal it's drawn in
truecolor with sparkles that twinkle through an 8-frame cycle:

```
              ✺          ✦            +
                  +                             +
       ·                  +                   ·
              ✦                ✺           ✦
            ██▓     ▒█████   ▒█████   ███▄ ▄███▓
           ▓██▒    ▒██▒  ██▒▒██▒  ██▒▓██▒▀█▀ ██▒
           ▒██░    ▒██░  ██▒▒██░  ██▒▓██    ▓██░
           ▒██░    ▒██   ██░▒██   ██░▒██    ▒██
           ░██████▒░ ████▓▒░░ ████▓▒░▒██▒   ░██▒
           ░ ▒░▓  ░░ ▒░▒░▒░ ░ ▒░▒░▒░ ░ ▒░   ░  ░
           ░ ░ ▒  ░  ░ ▒ ▒░   ░ ▒ ▒░ ░  ░      ░
             ░ ░   ░ ░ ░ ▒  ░ ░ ░ ▒  ░      ░
               ░  ░    ░ ░      ░ ░         ░

       TTY IDE for working alongside an AI coding agent

         /                      Open the slash command palette
         /filetree              Browse project files
         /edit <path>           Open a file for editing
         /find [glob] <regex>   Find in files (e.g. /find *.py def)
         /ai <prompt>           Ask the AI provider
         /cheatsheet            Full key tutorial (or press F1)
         /quit                  Quit (or Ctrl-Q)
```

## Install

### One-liner

```bash
curl -fsSL https://raw.githubusercontent.com/claytantor/loom-tty-ide/main/install.sh | bash
```

The installer is idempotent. It clones the repo to `~/.loom/app`, runs
`npm ci --omit=dev`, seeds `~/.loom/config.yml` and `~/.loom/themes/*.yml`
**only if they don't already exist**, and symlinks `loom` into
`/usr/local/bin` (falls back to `~/.local/bin` if the system path isn't
writable).

### From source

```bash
git clone https://github.com/claytantor/loom-tty-ide.git
cd loom-tty-ide
npm install
node bin/loom .
```

### Requirements

| | |
|---|---|
| Required | Node.js ≥ 18, `git`, `npm` |
| Recommended | `rg` (ripgrep) — used by `/find`; falls back to a JS regex walker if absent |
| Optional formatting | `prettier`, `eslint`, `ruff` — only invoked when present on `$PATH` |
| Optional LSP | `typescript-language-server`, `pyright-langserver` — silently disabled when missing |

## Run

```bash
loom .                          # open the current directory
loom path/to/repo               # open a specific project
loom --theme solarized-dark .   # override the theme
loom --help
loom --version
```

## How loom is organised

Loom uses a slash-command paradigm. There are no global keybindings beyond
opening the palette and quitting. Every capability is a slash command;
selecting one enters its **mode**, and only inside that mode do its
keybindings apply. Press `Esc` (or `:q` from the editor) to leave a mode
and return to the splash.

### Slash commands

From the splash, type `/` to open the palette. Type to filter, `Up`/`Down`
to navigate, `Enter` to run, `Esc` to dismiss.

| Command | Description |
|---|---|
| `/filetree` | Browse the project tree (enters filetree mode) |
| `/edit [path]` | Open a file for editing (enters edit mode — full vim) |
| `/find [glob] <regex>` | Search files. `glob` is optional, e.g. `*.py`, `foo.py`, `src/**/*.ts` |
| `/ai [prompt]` | Stream an AI response into a scratch buffer |
| `/save` | Save the active file |
| `/format` | Run `prettier`/`ruff` on the active file |
| `/blame` | `git blame` for the active file |
| `/diff` | `git diff` for the active file |
| `/split v\|h` | Split editor vertically / horizontally |
| `/close` | Close the active split |
| `/theme <name>` | Switch theme |
| `/cheatsheet`, `/help` | Full key tutorial |
| `/quit` | Quit loom (confirms first) |

### Global keys (always active)

| Key | Action |
|---|---|
| `/` | Open command palette (only from no-mode splash) |
| `Ctrl-K` | Open command palette (works from inside any mode) |
| `F1` | Open cheat sheet |
| `Ctrl-Q` / `Ctrl-C` | Quit (confirms first) |

### Mode-specific keys

Defaults shown below — every key is configurable in `~/.loom/keybindings.yml`.

**Filetree mode**

| Key | Action |
|---|---|
| `j` / `k` (or arrows) | Move down / up |
| `l` / `Right` | Expand directory or open file |
| `h` / `Left` | Collapse or jump to parent |
| `Enter` | Dir → re-root · File → open |
| `/` | Filename fuzzy filter |
| `g` / `G` | Top / bottom |
| `Ctrl-D` / `Ctrl-U` | Page down / up |
| `Esc` | Close (or exit filter) |

**Find mode**

| Key | Action |
|---|---|
| `j` / `k` (or arrows) | Move through results |
| `Enter` | Jump to file at line |
| `Esc` | Close |

**Edit mode**

Full vim bindings — see the cheat sheet (`F1`) for the complete reference.
Notable Ex commands and meta keys:

| Command / Key | Action |
|---|---|
| `:w` / `Ctrl-S` | Save |
| `:wq` / `:x` | Save and return to splash (does *not* quit loom) |
| `:q` | Return to splash (errors if unsaved) |
| `:q!` | Return to splash, discarding changes |
| `:%s/old/new/g` | Substitute |
| `:set nu` / `:set nonu` / `:set nu!` | Show / hide / toggle the line-number gutter |
| `F2` / `Ctrl-N` | Toggle the line-number gutter (so terminal selection picks up only source code) |

### Tree re-rooting

When you press `Enter` on a directory, it becomes the new tree root —
useful for diving into one part of a monorepo without scrolling past
everything else. The status bar reflects the new root. The original root
is restored on next launch.

## Copy-paste, scrollback, and the mouse

Loom never enables mouse capture. Gnome Terminal's native selection
(shift-drag, `Shift-Ctrl-C`) works in every pane and overlay without
falling through to a tmux-style copy mode. iTerm2, kitty, Alacritty, and
WezTerm all behave the same way.

A few practical knobs:

- Loom uses the alternate screen, so scrollback above the IDE isn't
  accessible while it's running. Scroll inside the editor pane (vim keys)
  or the find-results overlay instead.
- Hit `F2` (or `Ctrl-N`, or type `:set nu!`) to hide the line-number
  gutter so a copy-paste selection picks up only the source code.

## Configuration

`~/.loom/config.yml`:

```yaml
theme: default
editor:
  tabSize: 2
  showLineNumbers: true
ignore:
  - node_modules
  - .git
  - dist
ai:
  provider: anthropic       # anthropic | openai | ollama
  anthropic:
    model: claude-sonnet-4-20250514
    apiKeyEnv: ANTHROPIC_API_KEY
  openai:
    model: gpt-4o-mini
    apiKeyEnv: OPENAI_API_KEY
  ollama:
    model: llama3.1
    baseUrl: http://localhost:11434
```

API keys are read from the env var named in `apiKeyEnv` — never stored in
the config file.

`LOOM_HOME` overrides `~/.loom/` if you need a different location (useful
for testing or for sandboxing into project-local config).

### Customising key bindings

`~/.loom/keybindings.yml` is per-mode. Only the keys you specify are
overridden; everything else falls through to defaults.

```yaml
global:
  palette: /              # primary trigger (only from no-mode)
  paletteAlt: C-k         # works from inside any mode
  quit: C-q
  quitForce: C-c
  cheatsheet: f1

filetree:
  down: [j, down]         # also accepts a single string
  up:   [k, up]
  expand: [l, right]
  collapse: [h, left]
  open: enter
  filter: /
  exit: escape

find:
  down: [j, down]
  up:   [k, up]
  open: enter
  exit: escape

cheatsheet:
  pageDown: [space, C-d, pagedown]
  pageUp:   [b, C-u, pageup]
  exit:     [escape, q]

edit:
  save:              C-s
  toggleLineNumbers: [f2, C-n]
```

Key names use blessed conventions: `j`, `enter`, `escape`, `space`, `tab`,
`up`/`down`/`left`/`right`, `home`/`end`, `pageup`/`pagedown`, `f1`–`f12`,
and `C-x` / `S-x` / `M-x` for Ctrl/Shift/Meta combos.

### Themes

Bundled: `default`, `solarized-dark`, `high-contrast`. To add your own,
drop a YAML file in `~/.loom/themes/` and reference it by stem in
`config.yml`.

```yaml
# ~/.loom/themes/my-theme.yml
name: my-theme
foreground: white
background: black
accent: cyan
gutter: gray
selection: blue
statusbar:
  foreground: black
  background: cyan
syntax:
  keyword: magenta
  string: green
  number: yellow
  comment: gray
  type: cyan
  function: magenta
```

User themes shadow bundled ones with the same name. Missing themes fall
back to `default`.

## Architecture

```
loom/
├── bin/loom                       entry shim
├── install.sh                     idempotent installer
├── examples/config.yml            seeded into ~/.loom/config.yml
├── themes/                        bundled themes
├── src/
│   ├── index.js                   argv, config bootstrap
│   ├── app.js                     screen, global keys, wiring
│   ├── config.js                  ~/.loom/ loading & seeding
│   ├── theme.js                   YAML theme loader
│   ├── keybindings.js             per-mode keybinding loader
│   ├── slash/
│   │   ├── palette.js             command palette overlay
│   │   └── registry.js            command registration / fuzzy match
│   ├── overlay/
│   │   ├── file-tree.js           modal file tree (vim nav, fuzzy filter)
│   │   ├── tree-model.js          pure tree state (ignore, expand, fuzzy)
│   │   ├── find-results.js        find-in-files results overlay
│   │   ├── ai-prompt.js           AI prompt overlay
│   │   ├── cheat-sheet.js         tutorial overlay
│   │   └── modal-helpers.js       activate/deactivate, focus, grab fix
│   ├── editor/
│   │   ├── editor.js              view, modes, save, animated splash
│   │   ├── vim.js                 full vim state machine (operators, motions)
│   │   ├── cursor-render.js       block-cursor + gutter + visual highlights
│   │   ├── buffers.js             split layout & focus management
│   │   ├── split-tree.js          pure split tree (test-friendly)
│   │   ├── highlight.js           cli-highlight + per-scope colour mapping
│   │   └── lint.js                prettier / ruff dispatch
│   ├── search/find-in-files.js    ripgrep + JS-walker fallback + glob filter
│   ├── ai/
│   │   ├── index.js               provider router
│   │   ├── sse.js                 server-sent-events parser
│   │   ├── anthropic.js           streaming via fetch
│   │   ├── openai.js              stub
│   │   └── ollama.js              stub
│   ├── git/
│   │   ├── status.js              porcelain=v2 parser + cache
│   │   ├── blame.js               porcelain blame parser
│   │   └── diff.js                git diff dispatch
│   ├── lsp/
│   │   ├── manager.js             spawn / route per language
│   │   ├── client.js              JSON-RPC over stdio
│   │   └── framing.js             Content-Length framer
│   └── ui/
│       ├── splash.js              animated neon LOOM splash
│       └── statusbar.js           file path · mode · cursor · streaming
└── tests/                         node:test, mirrors src/ for non-TUI modules
```

### Choices worth knowing

- **neo-blessed** for the TUI. Better than Ink for IDE-style layouts (modal
  overlays, focus management). Mouse capture is intentionally off.
- **cli-highlight** for syntax highlighting, mapping every interesting
  highlight.js scope (`tag`, `attr`, `selector-*`, `built_in`, `variable`,
  `addition`/`deletion`, …) so the output is colourful, not three flavours
  of grey.
- **chalk truecolor** for the splash, status bar, and find-results — auto-
  downgrades to 256 / 16 colours when truecolor isn't supported.
- **figures + string-width + cli-truncate** for ANSI-aware width math —
  every overlay row is truncated to fit the modal cleanly.
- **Shell-out** for lint/format (`prettier`, `eslint`, `ruff`).
- **ripgrep** preferred for find-in-files; pure-JS fallback when `rg` is
  absent. Globs (`*.py`, `src/**/*.ts`, `foo.py`) are passed through to rg
  natively, or compiled to regex for the JS walker.
- **fetch-only** AI clients (no SDKs). Keeps the dependency footprint tiny.
- **Pure modules** for everything testable. `tree-model.js`,
  `split-tree.js`, the SSE parser, the LSP framer, the git-porcelain
  parsers, the vim state machine, and the overlay row-formatter all run
  without blessed and have direct unit tests.

## Development

```bash
npm install
npm test            # node --test tests/
node bin/loom .     # run from source
```

Tests use the built-in `node:test` runner — no test framework dependency.
The TUI itself is intentionally not unit-tested; the project policy is
that anything worth testing gets pulled into a pure module first.

### Layout for new contributors

| If you want to … | Start in |
|---|---|
| add a slash command | `src/app.js` (search for `registry.register`) |
| add an editor feature | `src/editor/editor.js` |
| add a vim binding | `src/editor/vim.js` (see `tests/vim.test.js` for the patterns) |
| add an AI provider | `src/ai/<name>.js` (export `complete({config, prompt, onChunk})`), then add it to the router in `src/ai/index.js` |
| add an overlay | `src/overlay/` — `find-results.js` is a small, complete template |
| extend the splash / animation | `src/ui/splash.js` |

## Roadmap

- LSP go-to-definition, hover, completion popup
- Tree-sitter highlighting for languages cli-highlight doesn't cover well
- Persistent session restore (open buffers, splits, last cursor)
- A second AI mode that edits files in place with diff preview, not just
  a scratch buffer
- Status-bar streaming token counter when an AI call is in flight

## Contributing

Issues and pull requests welcome. Please:

- Run `npm test` before opening a PR.
- Keep TUI logic thin — extract anything testable into a pure module.
- Match the existing config/theme conventions: YAML, defaults in code,
  user values shadow defaults.
- Avoid heavyweight dependencies; check that the same thing isn't already
  in Node core or a tiny existing dep.

## License

MIT — see [LICENCE.md](LICENCE.md).
