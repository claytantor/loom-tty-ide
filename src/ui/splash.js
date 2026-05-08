// Startup splash: ASCII logo + key hints, vertically + horizontally centered
// inside the given width/height (in cells).

const LOGO = [
  ' ██╗      ██████╗  ██████╗ ███╗   ███╗',
  ' ██║     ██╔═══██╗██╔═══██╗████╗ ████║',
  ' ██║     ██║   ██║██║   ██║██╔████╔██║',
  ' ██║     ██║   ██║██║   ██║██║╚██╔╝██║',
  ' ███████╗╚██████╔╝╚██████╔╝██║ ╚═╝ ██║',
  ' ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝     ╚═╝',
];

const TAGLINE = 'TTY IDE for working alongside an AI coding agent';

const HINTS = [
  ['/',           'Open the slash command palette'],
  ['/filetree',   'Browse project files'],
  ['/edit <path>', 'Open a file for editing'],
  ['/find [glob] <regex>', 'Find in files (e.g. /find *.py def)'],
  ['/ai <prompt>', 'Ask the AI provider'],
  ['/cheatsheet', 'Full key tutorial (or press F1)'],
  ['/quit',       'Quit (or Ctrl-Q)'],
];

const FOOTER = 'Type / to open the command palette · F1 for the cheat sheet · Ctrl-C to quit';

function pad(line, width) {
  const len = visibleLen(line);
  if (len >= width) return line;
  const left = Math.floor((width - len) / 2);
  return ' '.repeat(left) + line;
}

// Strip ANSI for length computation. Splash text doesn't use ANSI today, but
// future-proofing the centering function is cheap.
function visibleLen(s) { return s.replace(/\x1b\[[0-9;]*m/g, '').length; }

function hintLines() {
  const keyW = Math.max(...HINTS.map(([k]) => k.length));
  return HINTS.map(([k, desc]) => `  ${k.padEnd(keyW)}   ${desc}`);
}

export function buildSplash(width = 80, height = 24) {
  const hints = hintLines();
  const block = [
    ...LOGO,
    '',
    TAGLINE,
    '',
    ...hints,
    '',
    FOOTER,
  ];

  // Find the widest line in the block, then left-pad every line by the same
  // amount so columns line up under each other while the block as a whole
  // sits centered.
  const blockWidth = Math.max(...block.map(visibleLen));
  const leftPad = Math.max(0, Math.floor((width - blockWidth) / 2));
  const padStr = ' '.repeat(leftPad);
  const aligned = block.map((line) => (line ? padStr + line : ''));

  // Vertical centering: prepend blank lines to push the block toward middle.
  const blank = Math.max(0, Math.floor((height - block.length) / 2));
  return Array(blank).fill('').concat(aligned).join('\n');
}
