import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'js-yaml';

export const DEFAULT_CONFIG = Object.freeze({
  theme: 'default',
  editor: { tabSize: 2, showLineNumbers: false },
  ignore: ['node_modules', '.git', 'dist'],
});

export function loomHome() {
  return process.env.LOOM_HOME || path.join(os.homedir(), '.loom');
}

export function configPath() {
  return path.join(loomHome(), 'config.yml');
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function deepMerge(base, override) {
  if (!isPlainObject(override)) return override === undefined ? base : override;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = isPlainObject(v) && isPlainObject(base?.[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

export class ConfigError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'ConfigError';
    if (cause) this.cause = cause;
  }
}

export function parseConfig(text) {
  let parsed;
  try {
    parsed = yaml.load(text);
  } catch (err) {
    throw new ConfigError(`config.yml is not valid YAML: ${err.message}`, { cause: err });
  }
  if (parsed != null && !isPlainObject(parsed)) {
    throw new ConfigError('config.yml must be a YAML mapping at the top level');
  }
  const merged = deepMerge(DEFAULT_CONFIG, parsed || {});
  validate(merged);
  return Object.freeze(merged);
}

function validate(cfg) {
  if (!Array.isArray(cfg.ignore)) {
    throw new ConfigError('ignore must be a list of strings');
  }
}

export function loadConfig({ path: filePath = configPath() } = {}) {
  let text = '';
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return Object.freeze(deepMerge(DEFAULT_CONFIG, {}));
    }
    throw new ConfigError(`could not read ${filePath}: ${err.message}`, { cause: err });
  }
  return parseConfig(text);
}
