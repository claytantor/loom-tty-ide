// Helpers for opening and closing modal overlays so that focus is reliably
// active immediately on show.
//
// The two failure modes we guard against:
//
//   1. screen.grabKeys / screen.lockKeys is sticky from a previous reader
//      (textbox / textarea readInput). While set, blessed silently drops
//      keypress and `key X` events, so the modal looks unresponsive.
//   2. Some other element with active readInput is still grabbing input.
//      We walk the screen graph and stop any reader (`_done('stop')`) so
//      it lets go of input before our modal opens.

export function activateModal({ screen, container, focus }) {
  cancelInFlightReaders(screen);
  screen.grabKeys = false;
  screen.lockKeys = false;

  if (container) {
    container.show();
    if (typeof container.setFront === 'function') container.setFront();
  }
  if (focus && typeof focus.focus === 'function') focus.focus();
  screen.render();
}

export function deactivateModal({ screen, container, restoreFocus }) {
  if (container && typeof container.hide === 'function') container.hide();
  if (restoreFocus && typeof restoreFocus.focus === 'function' && !restoreFocus.detached) {
    restoreFocus.focus();
  }
  screen.render();
}

export function cancelInFlightReaders(screen) {
  function walk(el) {
    if (!el) return;
    if (typeof el._done === 'function' && el._reading) {
      try { el._done('stop'); } catch {}
    }
    if (el.children) for (const c of el.children) walk(c);
  }
  walk(screen);
}
