# Loom

A TTY-based IDE designed for working alongside an AI coding agent over remote shells. Built on Node.js so it travels well, stays out of the mouse's way so copy-paste in Gnome Terminal just works, and treats `~/.loom/` as the single source of truth for config and themes.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/clay/loom/main/install.sh | bash
```

Requires Node.js ≥ 18, `git`, and `npm`. The installer clones into `~/.loom/app`, installs dependencies, seeds `~/.loom/config.yml` and `~/.loom/themes/*.yml` if missing, and symlinks `loom` into `/usr/local/bin`.

## Run

```bash
loom .              # open at cwd
loom path/to/repo   # open at a specific dir
loom --theme solarized-dark .
```

## Keys

| Scope | Key | Action |
|---|---|---|
| Global | `Ctrl-P` | Toggle file tree overlay |
| Global | `Ctrl-F` | Find in files (regex) |
| Global | `Ctrl-L` | Format the current file |
| Global | `Ctrl-Q` | Quit |
| Global | `?` | Help |
| Editor | `i` | Enter insert mode |
| Editor | `Esc` | Leave insert mode |
| Editor | `Ctrl-S` | Save |
| Tree | `j` / `k` | Move down / up |
| Tree | `l` / `→` | Expand directory or open file |
| Tree | `h` / `←` | Collapse or jump to parent |
| Tree | `Enter` | Dir → re-root the tree here · File → open in editor |
| Tree | `/` | Filename fuzzy filter |
| Tree | `Esc` | Close overlay (or exit filter) |
| Tree | `g` / `G` | Top / bottom |
| Tree | `Ctrl-D` / `Ctrl-U` | Page down / up |

### Tree re-rooting

When you press `Enter` on a directory, it becomes the new tree root — useful for diving into one part of a monorepo without scrolling past everything else. The status bar reflects the new root. Reopen the overlay with `Ctrl-P`; the original root is restored on next launch.

## Copy-paste

Loom never enables mouse capture. Gnome Terminal's native selection (shift-drag, Shift-Ctrl-C) works in every pane and overlay without falling through to a tmux-style copy mode.

A few practical knobs:

- Loom uses the alternate screen, so scrollback above the IDE isn't accessible while it's running. Scroll inside the editor pane (vi keys) or the find-results overlay instead.
- Line numbers are off by default in the gutter to keep selection clean. Toggle them in `config.yml` if you want them.

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

API keys are read from the env var named in `apiKeyEnv` — never stored in the config file.

## Themes

Bundled: `default`, `solarized-dark`, `high-contrast`. To add your own, drop a YAML file in `~/.loom/themes/` and reference it by stem in `config.yml`.

```yaml
# ~/.loom/themes/my-theme.yml
name: my-theme
foreground: white
accent: cyan
syntax:
  keyword: magenta
  string: green
  number: yellow
  comment: gray
```

## Architecture

```
loom/
├── bin/loom                      # entry shim
├── src/
│   ├── index.js                  # argv, config bootstrap
│   ├── app.js                    # screen, global keys, wiring
│   ├── config.js                 # ~/.loom/ loading & seeding
│   ├── theme.js                  # YAML theme loader
│   ├── overlay/file-tree.js      # the modal file tree (vim nav)
│   ├── editor/
│   │   ├── editor.js             # view + textarea edit mode
│   │   ├── highlight.js          # cli-highlight wrapper
│   │   └── lint.js               # shell-out to prettier/eslint/ruff
│   ├── search/find-in-files.js   # ripgrep with JS fallback
│   ├── ai/
│   │   ├── index.js              # provider router
│   │   ├── anthropic.js
│   │   ├── openai.js
│   │   └── ollama.js
│   └── ui/statusbar.js
├── themes/
│   ├── default.yml
│   ├── solarized-dark.yml
│   └── high-contrast.yml
└── examples/config.yml
```

Choices worth knowing:

- **neo-blessed** for the TUI. Better than Ink for IDE-style layouts (modal overlays, focus management). Mouse capture is intentionally off.
- **cli-highlight** for syntax highlighting (HTML/JS/TS/Py/YAML/JSON and more via highlight.js).
- **shell-out** for lint/format. `prettier` + `eslint` + `ruff` if installed locally.
- **ripgrep** preferred for find-in-files; pure-JS fallback when `rg` is absent.
- **fetch-only** AI clients (no SDKs). Keeps the dependency footprint tiny.

## Status

This is a v0 scaffold. Working: file tree overlay with all the navigation contract, theme loading, basic editor (read + edit + save), regex find-in-files, format dispatch, AI provider stubs.

Not yet wired:

- Streaming AI completion into the editor (the providers all return strings).
- Jumping the editor view to a specific line after opening from search.
- Multi-buffer / split panes.
- Git integration (status icons in the tree, blame, diff).
- LSP-driven completion / diagnostics — currently lint runs only on demand.