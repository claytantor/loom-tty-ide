import path from 'node:path';
import fs from 'node:fs';
import { loadConfig } from './config.js';
import { loadTheme } from './theme.js';

export const VERSION = '0.1.0';

const HELP = `loom — TTY IDE for working alongside an AI coding agent.

Usage:
  loom [path]                Open the given directory (default: cwd).
  loom --theme <name> [path] Override theme from config.
  loom --version             Print version.
  loom --help, -h            Show this message.

Config: ~/.loom/config.yml. Themes: ~/.loom/themes/<name>.yml.
`;

export class CliError extends Error {}

export function parseArgv(argv) {
  const out = { path: null, theme: null, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { out.help = true; continue; }
    if (a === '--version' || a === '-v') { out.version = true; continue; }
    if (a === '--theme') {
      const next = argv[++i];
      if (next === undefined) throw new CliError('--theme requires a value');
      out.theme = next;
      continue;
    }
    if (a.startsWith('--theme=')) { out.theme = a.slice('--theme='.length); continue; }
    if (a.startsWith('-')) throw new CliError(`unknown option: ${a}`);
    if (out.path !== null) throw new CliError(`unexpected extra argument: ${a}`);
    out.path = a;
  }
  if (out.path === null) out.path = '.';
  return out;
}

export async function main(argv = []) {
  let parsed;
  try {
    parsed = parseArgv(argv);
  } catch (err) {
    process.stderr.write(`loom: ${err.message}\n${HELP}`);
    process.exit(2);
  }
  if (parsed.help) { process.stdout.write(HELP); return; }
  if (parsed.version) { process.stdout.write(`loom ${VERSION}\n`); return; }

  const cwd = path.resolve(process.cwd(), parsed.path);
  const stat = fs.existsSync(cwd) ? fs.statSync(cwd) : null;
  if (!stat || !stat.isDirectory()) {
    process.stderr.write(`loom: not a directory: ${cwd}\n`);
    process.exit(1);
  }

  const config = loadConfig();
  const themeName = parsed.theme || config.theme || 'default';
  const theme = loadTheme(themeName);

  const { startApp } = await import('./app.js');
  await startApp({ cwd, config, theme });
}
