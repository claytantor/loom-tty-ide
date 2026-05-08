import { spawn } from 'node:child_process';
import url from 'node:url';
import { createFramer, frame } from './framing.js';

// Minimal LSP client. Speaks JSON-RPC 2.0 over stdio.

export class LspClient {
  constructor({ command, args, cwd }) {
    this.command = command;
    this.args = args || [];
    this.cwd = cwd;
    this.child = null;
    this.id = 0;
    this.pending = new Map();
    this.diagListeners = new Map(); // uri -> set of fns
    this.ready = null;
  }

  start() {
    if (this.ready) return this.ready;
    let child;
    try {
      child = spawn(this.command, this.args, { cwd: this.cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      this.ready = Promise.reject(err);
      return this.ready;
    }
    this.child = child;
    const framer = createFramer((msg) => this._handle(msg));
    child.stdout.on('data', (d) => framer(d));
    child.on('error', () => { this.child = null; });
    child.on('exit', () => { this.child = null; });

    this.ready = this._initialize();
    return this.ready;
  }

  async _initialize() {
    const rootUri = url.pathToFileURL(this.cwd).href;
    const result = await this.request('initialize', {
      processId: process.pid,
      rootUri,
      capabilities: {
        textDocument: {
          publishDiagnostics: { relatedInformation: false },
          synchronization: { didOpen: true, didChange: true, didClose: true },
          completion: { completionItem: { snippetSupport: false } },
        },
      },
      workspaceFolders: [{ uri: rootUri, name: 'workspace' }],
    });
    this.notify('initialized', {});
    return result;
  }

  request(method, params) {
    return new Promise((resolve, reject) => {
      if (!this.child) return reject(new Error('lsp child not running'));
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this._send({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify(method, params) {
    if (!this.child) return;
    this._send({ jsonrpc: '2.0', method, params });
  }

  _send(msg) {
    this.child.stdin.write(frame(msg));
  }

  _handle(msg) {
    if (msg.id != null && (msg.result !== undefined || msg.error !== undefined)) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message || 'lsp error'));
      else p.resolve(msg.result);
      return;
    }
    if (msg.method === 'textDocument/publishDiagnostics') {
      const { uri, diagnostics } = msg.params || {};
      const set = this.diagListeners.get(uri);
      if (set) for (const fn of set) fn(diagnostics || []);
    }
  }

  onDiagnostics(uri, fn) {
    let set = this.diagListeners.get(uri);
    if (!set) { set = new Set(); this.diagListeners.set(uri, set); }
    set.add(fn);
    return () => set.delete(fn);
  }

  async shutdown() {
    if (!this.child) return;
    try { await this.request('shutdown', null); } catch {}
    try { this.notify('exit'); } catch {}
    try { this.child.kill(); } catch {}
    this.child = null;
  }
}
