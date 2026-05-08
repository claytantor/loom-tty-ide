#!/usr/bin/env bash
# Loom installer. Idempotent.
set -euo pipefail

REPO_URL="${LOOM_REPO_URL:-https://github.com/claytantor/loom-tty-ide.git}"
BRANCH="${LOOM_BRANCH:-main}"
LOOM_HOME="${LOOM_HOME:-$HOME/.loom}"
APP_DIR="$LOOM_HOME/app"
THEMES_DIR="$LOOM_HOME/themes"

need() { command -v "$1" >/dev/null 2>&1 || { echo "loom-install: missing required tool: $1" >&2; exit 1; }; }
need git
need node
need npm

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "loom-install: Node.js >= 18 required (found $(node -v))" >&2
  exit 1
fi

mkdir -p "$LOOM_HOME" "$THEMES_DIR"

if [ -d "$APP_DIR/.git" ]; then
  echo "loom-install: updating $APP_DIR"
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH" >/dev/null
else
  echo "loom-install: cloning $REPO_URL -> $APP_DIR"
  git clone --quiet --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

echo "loom-install: installing dependencies"
( cd "$APP_DIR" && npm ci --omit=dev --no-audit --no-fund --loglevel=error )

# Seed config if missing.
if [ ! -f "$LOOM_HOME/config.yml" ] && [ -f "$APP_DIR/examples/config.yml" ]; then
  cp "$APP_DIR/examples/config.yml" "$LOOM_HOME/config.yml"
  echo "loom-install: seeded $LOOM_HOME/config.yml"
fi

# Seed themes that aren't present yet.
for theme in "$APP_DIR"/themes/*.yml; do
  [ -f "$theme" ] || continue
  name="$(basename "$theme")"
  if [ ! -f "$THEMES_DIR/$name" ]; then
    cp "$theme" "$THEMES_DIR/$name"
    echo "loom-install: seeded $THEMES_DIR/$name"
  fi
done

# Symlink the launcher.
LAUNCHER="$APP_DIR/bin/loom"
chmod +x "$LAUNCHER"

link_into() {
  local target_dir="$1"
  mkdir -p "$target_dir"
  ln -sf "$LAUNCHER" "$target_dir/loom"
  echo "loom-install: linked $target_dir/loom -> $LAUNCHER"
}

if [ -w /usr/local/bin ]; then
  link_into /usr/local/bin
elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  sudo ln -sf "$LAUNCHER" /usr/local/bin/loom
  echo "loom-install: linked /usr/local/bin/loom -> $LAUNCHER"
else
  link_into "$HOME/.local/bin"
  case ":$PATH:" in
    *":$HOME/.local/bin:"*) ;;
    *) echo "loom-install: add $HOME/.local/bin to PATH to use 'loom' globally" ;;
  esac
fi

echo "loom-install: done. Run 'loom .' in a project directory."
