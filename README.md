# Loom

A TTY-based IDE designed for working alongside an AI coding agent over remote
shells. Built on Node.js so it travels well, stays out of the mouse's way so
copy-paste in Gnome Terminal just works, and treats `~/.loom/` as the single
source of truth for config and themes.

## Highlights

- **Mouse capture is off, on purpose.** Shift-drag selection in Gnome Terminal
  works in every pane and overlay — no tmux-style copy-mode dance.
- **Modal file-tree overlay** with vim-style navigation, fuzzy filename filter,
  and `Enter`-to-reroot for diving into a corner of a monorepo.
- **AI as a first-class pane.** A streaming Anthropic provider is wired in;
  OpenAI and Ollama ship as stubs behind the same interface so you can drop
  them in without touching the editor.
- **Splits, git, LSP** — `Ctrl-W v/s` for vertical/horizontal splits, file-tree
  rows decorated with `git status` flags, blame and diff over `Ctrl-G b/d`,
  and TypeScript/Python language servers wired through stdio JSON-RPC for
  diagnostics.
- **Tiny dependency footprint.** No AI SDKs — just `fetch` and SSE. Lint and
  format shell out to whatever is on `$PATH` (`prettier`, `eslint`, `ruff`).

## Status

Loom is `v0.1.0`. The full feature set described in the TRD is implemented end
to end, with unit tests for every non-TUI module. It hasn't been hardened
against every shape of project on earth yet, so expect rough edges around big
codebases, exotic encodings, and unusual LSP servers. Issues and PRs are
welcome.

## Install

One-liner (clones to `~/.loom/app`, installs deps, seeds config and themes,
and symlinks `loom` into `/usr/local/bin` — falls back to `~/.local/bin` if
`/usr/local/bin` isn't writable):

```bash
curl -fsSL https://raw.githubusercontent.com/claytantor/loom-tty-ide/main/install.sh | bash
```

Requirements:

- Node.js >= 18
- `git`
- `npm`

Optional but recommended:

- `rg` (ripgrep) — used by find-in-files; falls back to a JS regex walker if
  absent
- `prettier`, `eslint`, `ruff` — used by `Ctrl-L` formatting; only invoked if
  installed
- `typescript-language-server`, `pyright-langserver` — used for LSP
  diagnostics; silently disabled when not on `$PATH`

### From source

```bash
git clone https://github.com/claytantor/loom-tty-ide.git
cd loom-tty-ide
npm install
node bin/loom .
```

## Run

```bash
loom .                       # open the current directory
loom path/to/repo            # open a specific project
loom --theme solarized-dark .
loom --help
loom --version
```

## How loom is organised

loom uses a slash-command paradigm: there are no global keybindings beyond
opening the palette and quitting. Every capability is a slash command.
Selecting a command enters its **mode** — and only inside that mode do its
keybindings apply. Press `Esc` (or `:q` from the editor) to leave a mode and
return to the splash screen.

### Slash commands

From the splash screen, type `/` to open the command palette. Type to
filter, `Up`/`Down` to navigate, `Enter` to run, `Esc` to dismiss.

| Command | Description |
|---|---|
| `/filetree` | Browse the project tree (enters filetree mode) |
| `/edit [path]` | Open a file for editing (enters edit mode — full vim) |
| `/find <regex>` | Search files (enters find mode with results) |
| `/ai [prompt]` | Stream an AI response into a scratch buffer |
| `/save` | Save the active file |
| `/format` | Run prettier/ruff on the active file |
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

Defaults are listed below. Every key is configurable in `~/.loom/keybindings.yml`.

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
Notable Ex commands:

| Command | Action |
|---|---|
| `:w` | Save |
| `:wq` / `:x` | Save and return to splash (does *not* quit loom) |
| `:q` | Return to splash (errors if unsaved) |
| `:q!` | Return to splash, discarding changes |
| `:%s/old/new/g` | Substitute |

### Tree re-rooting

When you press `Enter` on a directory, it becomes the new tree root — useful
for diving into one part of a monorepo without scrolling past everything else.
The status bar reflects the new root. The original root is restored on next
launch.

## Copy-paste

Loom never enables mouse capture. Gnome Terminal's native selection
(shift-drag, Shift-Ctrl-C) works in every pane and overlay without falling
through to a tmux-style copy mode.

A few practical knobs:

- Loom uses the alternate screen, so scrollback above the IDE isn't accessible
  while it's running. Scroll inside the editor pane (vi keys) or the
  find-results overlay instead.
- Line numbers are off by default to keep selection clean. Toggle them in
  `config.yml`.

## Config

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

API keys are read from the env var named in `apiKeyEnv` — never stored in the
config file.

`LOOM_HOME` overrides `~/.loom/` if you need a different location (useful for
testing or for sandboxing into project-local config).

## Customising key bindings

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
  down: j                 # also accepts arrays: [j, down]
  up: k
  expand: l
  collapse: h
  open: enter
  filter: /
  exit: escape

find:
  down: j
  up: k
  open: enter
  exit: escape

cheatsheet:
  pageDown: [space, C-d, pagedown]
  pageUp:   [b, C-u, pageup]
  exit:     [escape, q]

edit:
  save: C-s               # vim's intrinsic motions/operators are not remapped
```

Key names use blessed conventions: `j`, `enter`, `escape`, `space`, `tab`,
`up`/`down`/`left`/`right`, `home`/`end`, `pageup`/`pagedown`, `f1`–`f12`,
and `C-x` / `S-x` / `M-x` for Ctrl/Shift/Meta combos.

## Themes

Bundled: `default`, `solarized-dark`, `high-contrast`. To add your own, drop a
YAML file in `~/.loom/themes/` and reference it by stem in `config.yml`.

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

User themes shadow bundled ones with the same name. If a referenced theme is
missing, Loom falls back to `default`.

## Architecture

```
loom/
├── bin/loom                       # entry shim
├── install.sh                     # idempotent installer
├── examples/config.yml            # seeded into ~/.loom/config.yml
├── themes/                        # bundled themes
├── src/
│   ├── index.js                   # argv, config bootstrap
│   ├── app.js                     # screen, global keys, wiring
│   ├── config.js                  # ~/.loom/ loading & seeding
│   ├── theme.js                   # YAML theme loader
│   ├── overlay/
│   │   ├── file-tree.js           # modal file tree (vim nav)
│   │   ├── tree-model.js          # pure tree state (ignore, fuzzy, expand)
│   │   ├── find-results.js        # find-in-files results overlay
│   │   └── ai-prompt.js           # AI / find / help prompt overlay
│   ├── editor/
│   │   ├── editor.js              # view + textarea, modes, save, append
│   │   ├── buffers.js             # split layout & focus management
│   │   ├── split-tree.js          # pure split tree (test-friendly)
│   │   ├── highlight.js           # cli-highlight wrapper
│   │   └── lint.js                # prettier / ruff dispatch
│   ├── search/find-in-files.js    # ripgrep with JS fallback
│   ├── ai/
│   │   ├── index.js               # provider router
│   │   ├── sse.js                 # SSE event-stream parser
│   │   ├── anthropic.js           # streaming via fetch
│   │   ├── openai.js              # stub
│   │   └── ollama.js              # stub
│   ├── git/
│   │   ├── status.js              # porcelain=v2 parser + cache
│   │   ├── blame.js               # porcelain blame parser
│   │   └── diff.js                # git diff dispatch
│   ├── lsp/
│   │   ├── manager.js             # spawn / route per language
│   │   ├── client.js              # JSON-RPC over stdio
│   │   └── framing.js             # Content-Length framer
│   └── ui/statusbar.js
└── tests/                         # node:test, mirrors src/ for non-TUI modules
```

Choices worth knowing:

- **neo-blessed** for the TUI. Better than Ink for IDE-style layouts (modal
  overlays, focus management). Mouse capture is intentionally off.
- **cli-highlight** for syntax highlighting (HTML/JS/TS/Py/YAML/JSON and more
  via highlight.js).
- **Shell-out** for lint/format (`prettier`, `eslint`, `ruff`).
- **ripgrep** preferred for find-in-files; pure-JS fallback when `rg` is
  absent.
- **fetch-only** AI clients (no SDKs). Keeps the dependency footprint tiny.
- **Pure modules** for everything testable. `tree-model.js`, `split-tree.js`,
  the SSE parser, the LSP framer, and the git-porcelain parsers all run
  without blessed and have direct unit tests.

## Development

```bash
npm install
npm test            # node --test tests/
node bin/loom .     # run from source
```

Tests use the built-in `node:test` runner — no test framework dependency.

The TUI itself is intentionally not unit-tested; the project policy is that
anything worth testing gets pulled into a pure module first.

### Layout for new contributors

If you want to add an editor feature, start in `src/editor/editor.js`. If you
want to add an AI provider, drop a new file in `src/ai/` that exports
`complete({ config, prompt, onChunk })` and add it to the router in
`src/ai/index.js`. New overlays go in `src/overlay/` and follow the
show/hide/toggle convention; existing overlays are good templates.

## Roadmap

The TRD's "Not yet wired" list is now wired. Open directions:

- LSP go-to-definition, hover, completion popup
- Tree-sitter-based highlighting for languages cli-highlight doesn't cover well
- Persistent session restore (open buffers, splits, last cursor)
- A second AI mode that edits files in place with diff preview, not just a
  scratch buffer

## Contributing

Issues and pull requests welcome. Please:

- Run `npm test` before opening a PR.
- Keep TUI logic thin — extract anything testable into a pure module.
- Match the existing config/theme conventions: YAML, defaults in code, user
  values shadow defaults.
- Avoid adding heavyweight dependencies; check that the same thing isn't
  already in Node core or a tiny existing dep.

## License

MIT — see [LICENCE.md](LICENCE.md).
