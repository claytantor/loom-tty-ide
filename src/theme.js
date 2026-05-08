import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import yaml from 'js-yaml';
import { loomHome } from './config.js';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BUNDLED_DIR = path.resolve(__dirname, '..', 'themes');

export const DEFAULT_THEME = Object.freeze({
  name: 'default',
  foreground: 'white',
  background: 'black',
  accent: 'cyan',
  gutter: 'gray',
  selection: 'blue',
  statusbar: { foreground: 'black', background: 'cyan' },
  syntax: {
    keyword: 'blue',
    string: 'green',
    number: 'yellow',
    comment: 'gray',
    type: 'cyan',
    function: 'magenta',
  },
});

export class ThemeError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'ThemeError';
    if (cause) this.cause = cause;
  }
}

function tryRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export function searchPaths(name) {
  return [
    path.join(loomHome(), 'themes', `${name}.yml`),
    path.join(BUNDLED_DIR, `${name}.yml`),
  ];
}

function parse(text, source) {
  try {
    const obj = yaml.load(text);
    if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new ThemeError(`${source} must be a YAML mapping`);
    }
    return obj;
  } catch (err) {
    if (err instanceof ThemeError) throw err;
    throw new ThemeError(`${source} is not valid YAML: ${err.message}`, { cause: err });
  }
}

export function loadTheme(name = 'default') {
  const tried = [];
  for (const candidate of searchPaths(name)) {
    tried.push(candidate);
    const text = tryRead(candidate);
    if (text != null) return Object.freeze({ ...DEFAULT_THEME, ...parse(text, candidate) });
  }
  if (name !== 'default') return loadTheme('default');
  return DEFAULT_THEME;
}
