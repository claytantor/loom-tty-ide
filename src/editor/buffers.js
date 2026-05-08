import { createEditorPane } from './editor.js';
import * as st from './split-tree.js';

// Buffer = a single editor pane backed by an in-memory text + optional file path.
// Splits hold leaf ids; each leaf id maps to a buffer/pane.

export function createBufferManager({
  parent, screen, theme, config, cwd, statusbar, lsp,
  onDirtyChange, onModeChange, onFileChange, onDiagnostics, onCursorChange, onSave,
}) {
  const panes = new Map(); // leafId -> pane
  let root = st.makeRoot();
  let activeId = root.id;
  let chordPending = false;

  function makePane() {
    const pane = createEditorPane({
      parent,
      screen,
      theme,
      config,
      lsp,
      onDirtyChange: (d) => { if (paneIsActive(pane)) onDirtyChange?.(d); },
      onModeChange: (m) => { if (paneIsActive(pane)) onModeChange?.(m); },
      onFileChange: (f) => { if (paneIsActive(pane)) onFileChange?.(f); },
      onCursorChange: (c) => { if (paneIsActive(pane)) onCursorChange?.(c); },
      onSave,
    });
    pane.box.hide();
    return pane;
  }

  function paneIsActive(pane) { return panes.get(activeId) === pane; }

  panes.set(activeId, makePane());

  function relayout() {
    const rect = { top: parent.atop, left: parent.aleft, width: parent.width, height: parent.height };
    const lay = st.layout(root, { top: 0, left: 0, width: rect.width, height: rect.height });
    for (const [id, pane] of panes) {
      const r = lay.get(id);
      if (!r) { pane.box.hide(); continue; }
      pane.box.top = r.top;
      pane.box.left = r.left;
      pane.box.width = r.width;
      pane.box.height = r.height;
      pane.box.show();
      pane.setActive(id === activeId);
      pane.rerender();
    }
    panes.get(activeId)?.focus();
    screen.render();
  }

  function active() { return panes.get(activeId); }

  function setActiveLeaf(id) {
    if (!panes.has(id)) return;
    activeId = id;
    const pane = panes.get(id);
    onFileChange?.(pane.state.file);
    onDirtyChange?.(pane.state.dirty);
    onModeChange?.(pane.state.mode);
    relayout();
  }

  function openFile(file) {
    const pane = active();
    pane.openFile(file);
    onFileChange?.(file);
    relayout();
  }

  function openFileAt(file, line) {
    const pane = active();
    pane.openAt(file, line);
    onFileChange?.(file);
    relayout();
  }

  function openScratch(name = 'scratch') {
    const pane = active();
    pane.openScratch(name);
    onFileChange?.(`[${name}]`);
    relayout();
    return {
      appendStreaming: (chunk) => pane.appendStreaming(chunk),
    };
  }

  function activeDirty() { return active().state.dirty; }

  function hasFile() {
    const f = active().state.file;
    return !!(f && !f.startsWith('['));
  }

  async function formatActive() {
    return active().format();
  }

  function splitActive(orient) {
    const { tree, newId } = st.split(root, activeId, orient);
    root = tree;
    panes.set(newId, makePane());
    setActiveLeaf(newId);
  }

  function closeActive() {
    const next = st.close(root, activeId);
    if (!next) {
      // Last pane — reset to fresh single pane.
      const pane = panes.get(activeId);
      pane.dispose();
      panes.clear();
      const id = st.newLeafId();
      panes.set(id, makePane());
      root = st.makeRoot(id);
      activeId = id;
      relayout();
      return;
    }
    const pane = panes.get(activeId);
    pane.dispose();
    panes.delete(activeId);
    root = next;
    // Pick any remaining leaf.
    const remaining = st.leaves(root);
    activeId = remaining[0].id;
    setActiveLeaf(activeId);
  }

  function moveFocus(dir) {
    const id = st.neighbour(root, activeId, dir);
    if (id) setActiveLeaf(id);
  }

  // Ctrl-W chord handling at the screen level.
  screen.key(['C-w'], () => { chordPending = true; });
  screen.on('keypress', (_ch, key) => {
    if (!chordPending) return;
    chordPending = false;
    if (!key) return;
    switch (key.full) {
      case 'v': splitActive('v'); return;
      case 's': splitActive('h'); return;
      case 'q': closeActive(); return;
      case 'h': case 'left':  moveFocus('h'); return;
      case 'j': case 'down':  moveFocus('j'); return;
      case 'k': case 'up':    moveFocus('k'); return;
      case 'l': case 'right': moveFocus('l'); return;
    }
  });

  // Cycle buffers with Ctrl-Tab.
  screen.key(['C-tab'], () => {
    const ls = st.leaves(root);
    const idx = ls.findIndex((l) => l.id === activeId);
    setActiveLeaf(ls[(idx + 1) % ls.length].id);
  });

  // Initial layout once parent has dimensions.
  setImmediate(relayout);
  screen.on('resize', relayout);

  return {
    openFile,
    openFileAt,
    openScratch,
    formatActive,
    activeDirty,
    hasFile,
    splitActive,
    closeActive,
    moveFocus,
    relayout,
    active,
  };
}
