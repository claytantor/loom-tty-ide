// Startup splash: stylized neon LOOM logo with multi-layer color, twinkling
// sparkles, and key hints. Centered vertically + horizontally inside the
// given width/height (in cells). Inspired by the loom.png pixel-art neon
// graffiti.
//
// The base letterforms are baked from the FIGlet "Bloody" font — that font
// uses ░ ▒ ▓ █ density characters which already give a natural multi-tone
// banding. We map each density to a color from the loom.png palette to get
// the white-cyan-blue "neon glow" stack:
//
//     █ (full block)   → bright white-cyan, bold   (the inner core)
//     ▓ (heavy shade)  → electric cyan              (mid ring)
//     ▒ (medium shade) → cyan-blue                  (outer ring)
//     ░ (light shade)  → deep blue                  (outer glow / drips)
//
// Sparkles are overlaid in a stable set of positions; each one cycles a
// brightness phase based on the global frame counter so they twinkle.

import chalk from 'chalk';

// ── logo (Bloody font, pre-baked) ────────────────────────────────────────────
const LOGO = [
  ' ██▓     ▒█████   ▒█████   ███▄ ▄███▓',
  '▓██▒    ▒██▒  ██▒▒██▒  ██▒▓██▒▀█▀ ██▒',
  '▒██░    ▒██░  ██▒▒██░  ██▒▓██    ▓██░',
  '▒██░    ▒██   ██░▒██   ██░▒██    ▒██ ',
  '░██████▒░ ████▓▒░░ ████▓▒░▒██▒   ░██▒',
  '░ ▒░▓  ░░ ▒░▒░▒░ ░ ▒░▒░▒░ ░ ▒░   ░  ░',
  '░ ░ ▒  ░  ░ ▒ ▒░   ░ ▒ ▒░ ░  ░      ░',
  '  ░ ░   ░ ░ ░ ▒  ░ ░ ░ ▒  ░      ░   ',
  '    ░  ░    ░ ░      ░ ░         ░   ',
];

const LOGO_W = Math.max(...LOGO.map((l) => l.length));
const LOGO_H = LOGO.length;

const TAGLINE = 'TTY IDE for working alongside an AI coding agent';

const HINTS = [
  ['/',                    'Open the slash command palette'],
  ['/filetree',            'Browse project files'],
  ['/edit <path>',         'Open a file for editing'],
  ['/find [glob] <regex>', 'Find in files (e.g. /find *.py def)'],
  ['/ai <prompt>',         'Ask the AI provider'],
  ['/cheatsheet',          'Full key tutorial (or press F1)'],
  ['/quit',                'Quit (or Ctrl-Q)'],
];

const FOOTER = 'Type / to open the command palette · F1 for the cheat sheet · Ctrl-C to quit';

// ── palette ──────────────────────────────────────────────────────────────────
const C = {
  full:    chalk.hex('#cffaff').bold,   // █ — inner shine
  heavy:   chalk.hex('#22e8ff').bold,   // ▓ — electric cyan
  medium:  chalk.hex('#1a90e0'),        // ▒ — cyan-blue
  light:   chalk.hex('#0d3a8a'),        // ░ — deep blue glow
  sparkleW:chalk.hex('#ffffff').bold,
  sparkleC:chalk.hex('#7ee8ff').bold,
  sparkleG:chalk.hex('#7ef0a0').bold,
  sparkleD:chalk.hex('#406088'),
  tagline: chalk.hex('#9ae8ff').italic,
  hintKey: chalk.hex('#7eddff'),
  hintDesc:chalk.hex('#aac4d4'),
  footer:  chalk.hex('#6a91a8'),
};

function colorFor(ch) {
  switch (ch) {
    case '█': return C.full;
    case '▓': return C.heavy;
    case '▒': return C.medium;
    case '░': return C.light;
    default:  return null;
  }
}

// ── sparkles ─────────────────────────────────────────────────────────────────
// Fixed positions inside an "expanded canvas" around the logo. (col,row,phase,colorKey)
// Coordinates are relative to the logo bounding box, with `topPad` rows of
// extra empty space above for sparkles to live in.
const TOP_PAD    = 4;        // empty rows above the logo for sparkles
const SIDE_PAD   = 2;        // empty cols on each side for sparkles
const CANVAS_W   = LOGO_W + SIDE_PAD * 2;
const CANVAS_H   = LOGO_H + TOP_PAD;

// Each sparkle: [col, row, phaseOffset, colorKey]
//  - col,row are positions in the expanded canvas (col includes SIDE_PAD)
//  - phaseOffset shifts where in the twinkle cycle this sparkle is
//  - colorKey ∈ 'W' | 'C' | 'G'  (white / cyan / green)
const SPARKLES = [
  [ 3,  0,  0, 'C'],
  [ 8,  1,  3, 'W'],
  [14,  0,  1, 'G'],
  [21,  1,  5, 'C'],
  [27,  0,  2, 'W'],
  [33,  2,  4, 'G'],
  [38,  1,  6, 'C'],
  [ 5,  3,  7, 'W'],
  [18,  3,  2, 'G'],
  [30,  3,  0, 'W'],
  [40,  3,  4, 'C'],
  [ 1,  2,  5, 'C'],
  [10,  2,  6, 'W'],
  [25,  2,  1, 'G'],
];

// Twinkle cycle: 8 frames. Each step picks a (char, color) pair so the
// sparkle gently grows, peaks, and fades — like the real ones in loom.png.
const SPARKLE_FRAMES = [
  null,            // off
  ['·', 'D'],      // dim dot
  ['+', 'C'],      // small plus
  ['✦', 'lit'],    // lit star
  ['✺', 'lit'],    // peak
  ['✦', 'lit'],
  ['+', 'C'],
  ['·', 'D'],
];
const SPARKLE_CYCLE = SPARKLE_FRAMES.length;

function sparkleColor(key, kind) {
  if (kind === 'D') return C.sparkleD;
  if (kind === 'C') return C.sparkleC; // small plus → soft cyan regardless of key
  // lit/peak: use the sparkle's own colour key
  if (key === 'W') return C.sparkleW;
  if (key === 'G') return C.sparkleG;
  return C.sparkleC;
}

// ── compose ──────────────────────────────────────────────────────────────────

function buildLogoCanvas(frame) {
  // 2D char grid sized to CANVAS_W × CANVAS_H. Each cell starts as ' '.
  const grid = Array.from({ length: CANVAS_H }, () => Array(CANVAS_W).fill(' '));

  // Place the logo at (TOP_PAD, SIDE_PAD).
  for (let r = 0; r < LOGO_H; r++) {
    const line = LOGO[r];
    for (let c = 0; c < line.length; c++) {
      grid[TOP_PAD + r][SIDE_PAD + c] = line[c];
    }
  }

  // Overlay sparkles. They're drawn in the empty rows above the logo plus
  // wherever they happen to land in transparent (' ') logo cells.
  for (const [c, r, phase, key] of SPARKLES) {
    if (r < 0 || r >= CANVAS_H) continue;
    if (c < 0 || c >= CANVAS_W) continue;
    const step = SPARKLE_FRAMES[(frame + phase) % SPARKLE_CYCLE];
    if (!step) continue;
    // Don't overwrite an actual logo glyph — sparkles only fill empty space.
    if (grid[r][c] !== ' ') continue;
    grid[r][c] = `\x00${step[0]}\x00${key}\x00${step[1]}\x00`;
    //                glyph     key       kind (C/D/lit)
  }
  return grid;
}

function renderGrid(grid) {
  return grid
    .map((row) => row.map((cell) => {
      if (cell === ' ') return ' ';
      if (cell.startsWith('\x00')) {
        const [, glyph, key, kind] = cell.split('\x00');
        return sparkleColor(key, kind)(glyph);
      }
      const fn = colorFor(cell);
      return fn ? fn(cell) : cell;
    }).join(''))
    .join('\n');
}

// Strip ANSI for length math.
function visibleLen(s) { return s.replace(/\x1b\[[0-9;]*m/g, '').length; }

function hintLines() {
  const keyW = Math.max(...HINTS.map(([k]) => k.length));
  return HINTS.map(([k, desc]) =>
    `  ${C.hintKey(k.padEnd(keyW))}   ${C.hintDesc(desc)}`,
  );
}

export function buildSplash(width = 80, height = 24, frame = 0) {
  const logoLines = renderGrid(buildLogoCanvas(frame)).split('\n');

  const block = [
    ...logoLines,
    '',
    C.tagline(TAGLINE),
    '',
    ...hintLines(),
    '',
    C.footer(FOOTER),
  ];

  // Center horizontally as one column.
  const blockWidth = Math.max(...block.map(visibleLen));
  const leftPad    = Math.max(0, Math.floor((width - blockWidth) / 2));
  const padStr     = ' '.repeat(leftPad);
  const aligned    = block.map((line) => (line ? padStr + line : ''));

  // Vertical centering.
  const blank = Math.max(0, Math.floor((height - block.length) / 2));
  return Array(blank).fill('').concat(aligned).join('\n');
}

// Frame interval (ms). Picked so sparkles twinkle without burning CPU.
export const SPLASH_FRAME_MS = 240;
