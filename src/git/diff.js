import { spawn } from 'node:child_process';

export function diff({ cwd, file }) {
  return new Promise((resolve) => {
    const child = spawn('git', ['--no-pager', 'diff', '--no-color', '--', file], { cwd });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', () => resolve(`(git diff failed)`));
    child.on('close', (code) => {
      if (code !== 0) return resolve(`(git diff exited ${code})\n${err}`);
      resolve(out || '(no changes)');
    });
  });
}
