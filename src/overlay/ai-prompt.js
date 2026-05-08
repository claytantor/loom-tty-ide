import blessed from 'neo-blessed';
import { cancelInFlightReaders } from './modal-helpers.js';

export function createAiPrompt({ screen, theme, onSubmit }) {
  const container = blessed.box({
    parent: screen,
    top: 'center', left: 'center',
    width: '70%', height: 5,
    border: { type: 'line' },
    label: ' AI prompt (Enter to submit, Esc to cancel) ',
    style: { fg: theme.foreground, bg: theme.background, border: { fg: theme.accent } },
    hidden: true,
  });
  const input = blessed.textbox({
    parent: container,
    top: 0, left: 1, right: 1, height: 1,
    inputOnFocus: true,
    style: { fg: theme.foreground, bg: theme.background },
  });

  function toggle() {
    if (container.visible) hide();
    else show();
  }
  function show() {
    cancelInFlightReaders(screen);
    screen.grabKeys = false;
    screen.lockKeys = false;
    container.show();
    container.setFront();
    container.setLabel(' AI prompt (Enter to submit, Esc to cancel) ');
    input.setValue('');
    input.focus();
    input.readInput((err, value) => {
      hide();
      if (value && value.trim()) onSubmit?.(value);
    });
    screen.render();
  }
  function hide() { container.hide(); screen.render(); }

  // Generic prompt — used by Find too.
  function prompt({ label }) {
    return new Promise((resolve) => {
      cancelInFlightReaders(screen);
      screen.grabKeys = false;
      screen.lockKeys = false;
      container.setLabel(` ${label} `);
      container.show();
      container.setFront();
      input.setValue('');
      input.focus();
      input.readInput((err, value) => {
        hide();
        resolve(value || '');
      });
      screen.render();
    });
  }

  function runWith(text) {
    if (text && text.trim()) onSubmit?.(text);
  }

  return { box: container, show, hide, toggle, prompt, runWith };
}
