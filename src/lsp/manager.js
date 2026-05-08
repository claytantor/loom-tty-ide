import url from 'node:url';
import { spawnSync } from 'node:child_process';
import { LspClient } from './client.js';

const SERVERS = {
  typescript: { command: 'typescript-language-server', args: ['--stdio'], languageId: 'typescript' },
  javascript: { command: 'typescript-language-server', args: ['--stdio'], languageId: 'javascript' },
  python: { command: 'pyright-langserver', args: ['--stdio'], languageId: 'python' },
};

function which(cmd) {
  try { return spawnSync('command', ['-v', cmd], { shell: true }).status === 0; }
  catch { return false; }
}

export class LspManager {
  constructor({ cwd }) {
    this.cwd = cwd;
    this.clients = new Map(); // langKey -> LspClient
    this._versions = new Map(); // uri -> int
    this._changeTimers = new Map(); // uri -> timeout
    this._diagListeners = new Map(); // uri -> set
  }

  _clientFor(language) {
    if (!language) return null;
    const spec = SERVERS[language];
    if (!spec) return null;
    if (!which(spec.command)) return null;
    if (!this.clients.has(language)) {
      const c = new LspClient({ command: spec.command, args: spec.args, cwd: this.cwd });
      this.clients.set(language, c);
      c.start().catch(() => { this.clients.delete(language); });
    }
    return this.clients.get(language);
  }

  async didOpen(filePath, text, language) {
    const client = this._clientFor(language);
    if (!client) return;
    try { await client.ready; } catch { return; }
    const uri = url.pathToFileURL(filePath).href;
    this._versions.set(uri, 1);
    client.notify('textDocument/didOpen', {
      textDocument: { uri, languageId: SERVERS[language].languageId, version: 1, text },
    });
    client.onDiagnostics(uri, (raw) => this._dispatchDiagnostics(uri, raw));
  }

  didChange(filePath, text) {
    const uri = url.pathToFileURL(filePath).href;
    const v = (this._versions.get(uri) || 1) + 1;
    this._versions.set(uri, v);
    clearTimeout(this._changeTimers.get(uri));
    const t = setTimeout(() => {
      for (const c of this.clients.values()) {
        if (!c.child) continue;
        c.notify('textDocument/didChange', {
          textDocument: { uri, version: v },
          contentChanges: [{ text }],
        });
      }
    }, 300);
    this._changeTimers.set(uri, t);
  }

  didClose(filePath) {
    const uri = url.pathToFileURL(filePath).href;
    for (const c of this.clients.values()) {
      if (!c.child) continue;
      try { c.notify('textDocument/didClose', { textDocument: { uri } }); } catch {}
    }
    this._diagListeners.delete(uri);
    this._versions.delete(uri);
  }

  onDiagnostics(filePath, fn) {
    const uri = url.pathToFileURL(filePath).href;
    let set = this._diagListeners.get(uri);
    if (!set) { set = new Set(); this._diagListeners.set(uri, set); }
    set.add(fn);
    return () => set.delete(fn);
  }

  _dispatchDiagnostics(uri, raw) {
    const set = this._diagListeners.get(uri);
    if (!set) return;
    const norm = (raw || []).map((d) => ({
      line: d.range?.start?.line ?? 0,
      severity: d.severity || 1,
      message: d.message || '',
    }));
    for (const fn of set) fn(norm);
  }

  async shutdownAll() {
    await Promise.allSettled([...this.clients.values()].map((c) => c.shutdown()));
    this.clients.clear();
  }
}
