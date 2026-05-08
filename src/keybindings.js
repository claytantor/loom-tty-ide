import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { loomHome } from './config.js';

// Default keybindings per mode. Users can override by writing
// ~/.loom/keybindings.yml — only override the keys they care about; the rest
// fall through to the defaults below.

export const DEFAULT_KEYBINDINGS = Object.freeze({
  // ── global: only active when no mode is selected (or as overrides) ──
  global: {
    palette:    '/',          // open the slash palette from no-mode
    paletteAlt: 'C-k',        // alternative palette trigger that works inside any mode
    quit:       'C-q',        // quit (with confirm)
    quitForce:  'C-c',        // quit (with confirm) — works always
    cheatsheet: 'f1',         // shortcut to /cheatsheet
    yes:        'y',          // for the quit-confirm dialog
    no:         'n',
  },

  // ── filetree mode keys ──
  filetree: {
    down:     ['j', 'down'],
    up:       ['k', 'up'],
    expand:   ['l', 'right'],
    collapse: ['h', 'left'],
    open:     'enter',
    top:      ['g', 'home'],
    bottom:   ['S-g', 'end'],
    pageDown: ['C-d', 'pagedown'],
    pageUp:   ['C-u', 'pageup'],
    filter:   '/',
    exit:     'escape',
  },

  // ── find-results mode keys ──
  find: {
    down:     ['j', 'down'],
    up:       ['k', 'up'],
    open:     'enter',
    top:      ['g', 'home'],
    bottom:   ['S-g', 'end'],
    pageDown: ['C-d', 'pagedown'],
    pageUp:   ['C-u', 'pageup'],
    exit:     'escape',
  },

  // ── cheatsheet mode keys ──
  cheatsheet: {
    down:     ['j', 'down'],
    up:       ['k', 'up'],
    pageDown: ['C-d', 'pagedown', 'space'],
    pageUp:   ['C-u', 'pageup', 'b'],
    top:      ['g', 'home'],
    bottom:   ['S-g', 'end'],
    exit:     ['escape', 'q'],
  },

  // ── edit mode (vim) — only meta keys are configurable; vim's own
  //    motions/operators are intrinsic to vim and not remapped here. ──
  edit: {
    save: 'C-s',
  },
});

export class KeybindingsError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'KeybindingsError';
    if (cause) this.cause = cause;
  }
}

export function keybindingsPath() {
  return path.join(loomHome(), 'keybindings.yml');
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function mergeKeybindings(base, override) {
  const out = {};
  for (const section of Object.keys(base)) {
    out[section] = { ...base[section], ...((override && override[section]) || {}) };
  }
  if (override) {
    for (const section of Object.keys(override)) {
      if (!out[section]) out[section] = { ...override[section] };
    }
  }
  return out;
}

export function parseKeybindings(text) {
  let parsed;
  try { parsed = yaml.load(text); }
  catch (err) {
    throw new KeybindingsError(`keybindings.yml is not valid YAML: ${err.message}`, { cause: err });
  }
  if (parsed != null && !isPlainObject(parsed)) {
    throw new KeybindingsError('keybindings.yml must be a YAML mapping');
  }
  return mergeKeybindings(DEFAULT_KEYBINDINGS, parsed || {});
}

export function loadKeybindings({ path: filePath = keybindingsPath() } = {}) {
  let text = '';
  try { text = fs.readFileSync(filePath, 'utf8'); }
  catch (err) {
    if (err.code === 'ENOENT') return mergeKeybindings(DEFAULT_KEYBINDINGS, {});
    throw new KeybindingsError(`could not read ${filePath}: ${err.message}`, { cause: err });
  }
  return parseKeybindings(text);
}

// Convert a config binding (string or array) into the array form blessed expects.
export function asArray(binding) {
  if (binding == null) return [];
  return Array.isArray(binding) ? binding : [binding];
}
