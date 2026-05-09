import blessed from 'neo-blessed';
import os from 'node:os';
import path from 'node:path';
import stringWidth from 'string-width';
import cliTruncate from 'cli-truncate';

// Render an absolute path with `~` for HOME. Falls through to the original
// path when it's outside the home directory.
export function homeRelative(p, home = os.homedir()) {
  if (!p) return '';
  if (p === home) return '~';
  if (p.startsWith(home + path.sep)) return '~' + p.slice(home.length);
  return p;
}

export function formatCursor(cursor) {
  if (!cursor) return '';
  // 1-indexed for display.
  const r = (cursor.row ?? 0) + 1;
  const c = (cursor.col ?? 0) + 1;
  const total = cursor.total ?? 0;
  return `Ln ${r}/${total}  Col ${c}`;
}

export function createStatusBar({ screen, theme, cwd }) {
  const colors = theme.statusbar || { foreground: 'black', background: 'cyan' };
  const box = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    height: 1,
    width: '100%',
    tags: true,
    style: { fg: colors.foreground, bg: colors.background },
    content: '',
  });

  const state = {
    cwd,
    file: null,
    mode: 'NORMAL',
    extraMode: 'none',
    dirty: false,
    diagnostics: 0,
    cursor: null,
    extra: '',
  };

  function render() {
    const fileLabel = state.file
      ? (state.file.startsWith('[')
          ? state.file
          : homeRelative(state.file))
      : '(no file)';
    const dirty = state.dirty ? '●' : ' ';
    const diag = state.diagnostics ? ` ⚠ ${state.diagnostics}` : '';
    const extra = state.extra ? ` ${state.extra}` : '';
    const modeLabel = state.extraMode === 'edit'
      ? `EDIT:${state.mode}`
      : (state.extraMode || 'none').toUpperCase();
    const cursorStr = state.extraMode === 'edit' && state.cursor
      ? `  ${formatCursor(state.cursor)}`
      : '';

    const left  = ` loom ${homeRelative(state.cwd)}  [ ${modeLabel} ] `;
    const right = ` ${dirty} ${fileLabel}${diag}${cursorStr}${extra} `;

    const cols = screen.width || 80;
    const leftW  = stringWidth(left);
    const rightW = stringWidth(right);

    let leftFinal = left;
    let rightFinal = right;

    // If both halves don't fit, shrink the file path on the right side first.
    if (leftW + rightW > cols) {
      // Truncate fileLabel preserving prefixes/suffixes.
      const others = ` ${dirty} ${diag}${cursorStr}${extra} `;
      const budget = Math.max(0, cols - leftW - stringWidth(others) - 1);
      const truncated = cliTruncate(fileLabel, Math.max(3, budget), { position: 'middle' });
      rightFinal = ` ${dirty} ${truncated}${diag}${cursorStr}${extra} `;
    }

    const finalLeftW  = stringWidth(leftFinal);
    const finalRightW = stringWidth(rightFinal);
    const pad = Math.max(1, cols - finalLeftW - finalRightW);
    box.setContent(leftFinal + ' '.repeat(pad) + rightFinal);
    screen.render();
  }

  function update(patch) {
    Object.assign(state, patch);
    render();
  }

  screen.on('resize', render);
  render();

  return { box, update, render, state };
}
