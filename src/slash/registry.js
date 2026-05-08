// Slash command registry. Pure module — no blessed.
// Commands describe themselves with a name, description, optional argument hint,
// and optional category. The registry handles registration, lookup, parsing
// "/cmd arg1 arg2…" input, and fuzzy filtering for the palette UI.

export function createRegistry() {
  const commands = [];

  function register(cmd) {
    if (!cmd?.name || typeof cmd.name !== 'string') {
      throw new Error('slash command requires a name');
    }
    if (commands.some((c) => c.name === cmd.name)) {
      throw new Error(`slash command "${cmd.name}" already registered`);
    }
    commands.push({
      name: cmd.name,
      description: cmd.description || '',
      argHint: cmd.argHint || '',
      category: cmd.category || 'general',
      run: cmd.run || (() => {}),
    });
  }

  function list() { return [...commands]; }

  function find(name) { return commands.find((c) => c.name === name) || null; }

  function parse(input) {
    const trimmed = (input || '').trimStart().replace(/^\//, '');
    const sp = trimmed.indexOf(' ');
    const name = sp >= 0 ? trimmed.slice(0, sp) : trimmed;
    const args = sp >= 0 ? trimmed.slice(sp + 1).trim() : '';
    return { name, args };
  }

  // Return commands matching `query` (a partial command name), ranked.
  function filter(query) {
    const q = (query || '').toLowerCase();
    if (!q) return list();
    const out = [];
    for (const c of commands) {
      const score = matchScore(q, c.name.toLowerCase());
      if (score > -2) out.push({ cmd: c, score });
    }
    out.sort((a, b) => a.score - b.score || a.cmd.name.localeCompare(b.cmd.name));
    return out.map((x) => x.cmd);
  }

  return { register, list, find, parse, filter };
}

// Subsequence fuzzy match. Lower score = better. Negative = no match.
// Adjacent matches score better than spread-out ones; a leading prefix scores
// best.
export function matchScore(needle, haystack) {
  if (!needle) return 0;
  if (haystack.startsWith(needle)) return -1; // prefix wins
  let i = 0, j = 0, score = 0, lastIdx = -1;
  while (i < needle.length && j < haystack.length) {
    if (needle[i] === haystack[j]) {
      score += lastIdx === -1 ? j : (j - lastIdx - 1);
      lastIdx = j;
      i++;
    }
    j++;
  }
  return i < needle.length ? -2 : score;
}
