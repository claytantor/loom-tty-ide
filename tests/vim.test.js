import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, handleKey, getText, applySearch, applySubstitute } from '../src/editor/vim.js';

function press(s, ...keys) {
  for (const k of keys) handleKey(s, k, k.length === 1 ? k : '');
}

function pressStr(s, str) {
  for (const ch of str) handleKey(s, ch, ch);
}

// ── cursor movement ────────────────────────────────────────────────────────────

test('hjkl moves cursor', () => {
  const s = createState('abc\ndef\nghi');
  press(s, 'j');
  assert.equal(s.cursor.row, 1);
  press(s, 'l');
  assert.equal(s.cursor.col, 1);
  press(s, 'k');
  assert.equal(s.cursor.row, 0);
  press(s, 'h');
  assert.equal(s.cursor.col, 0);
});

test('arrow keys move cursor', () => {
  const s = createState('abc\ndef');
  press(s, 'down');
  assert.equal(s.cursor.row, 1);
  press(s, 'right');
  assert.equal(s.cursor.col, 1);
  press(s, 'up');
  assert.equal(s.cursor.row, 0);
});

test('0 and $ move to line start/end', () => {
  const s = createState('hello world');
  press(s, '$');
  assert.equal(s.cursor.col, 10); // NORMAL max = len-1 = 10
  press(s, '0');
  assert.equal(s.cursor.col, 0);
});

test('^ moves to first non-blank', () => {
  const s = createState('   hello');
  press(s, '$', '^');
  assert.equal(s.cursor.col, 3);
});

test('w moves forward to next word start', () => {
  const s = createState('hello world foo');
  press(s, 'w');
  assert.equal(s.cursor.col, 6);
});

test('b moves back to previous word start', () => {
  const s = createState('hello world');
  s.cursor.col = 8;
  press(s, 'b');
  assert.equal(s.cursor.col, 6);
});

test('gg and G jump to first and last line', () => {
  const s = createState('a\nb\nc');
  press(s, 'G');
  assert.equal(s.cursor.row, 2);
  press(s, 'g');
  press(s, 'g');
  assert.equal(s.cursor.row, 0);
});

test('count prefix multiplies motion', () => {
  const s = createState('a\nb\nc\nd\ne');
  press(s, '3', 'j');
  assert.equal(s.cursor.row, 3);
});

// ── insert mode ───────────────────────────────────────────────────────────────

test('i enters INSERT mode', () => {
  const s = createState('hi');
  press(s, 'i');
  assert.equal(s.mode, 'INSERT');
});

test('Esc exits INSERT and moves cursor back', () => {
  const s = createState('abc');
  press(s, 'l', 'l', 'i');
  pressStr(s, 'X');
  press(s, 'escape');
  assert.equal(s.mode, 'NORMAL');
  assert.equal(getText(s), 'abXc');
});

test('a appends after cursor', () => {
  const s = createState('hi');
  press(s, 'a');
  pressStr(s, '!');
  press(s, 'escape');
  assert.equal(getText(s), 'h!i');
});

test('A appends at line end', () => {
  const s = createState('hi');
  press(s, 'A');
  pressStr(s, '!');
  press(s, 'escape');
  assert.equal(getText(s), 'hi!');
});

test('o opens new line below', () => {
  const s = createState('first\nlast');
  press(s, 'o');
  press(s, 'escape');
  assert.equal(s.lines.length, 3);
  assert.equal(s.cursor.row, 1);
});

test('O opens new line above', () => {
  const s = createState('first\nlast');
  press(s, 'j', 'O');
  press(s, 'escape');
  assert.equal(s.lines.length, 3);
  assert.equal(s.cursor.row, 1);
});

test('INSERT backspace deletes char before cursor', () => {
  const s = createState('abc');
  press(s, 'A');
  press(s, 'backspace');
  press(s, 'escape');
  assert.equal(getText(s), 'ab');
});

test('INSERT Enter splits line', () => {
  const s = createState('abcd');
  s.cursor.col = 2;
  press(s, 'i', 'enter', 'escape');
  assert.equal(s.lines[0], 'ab');
  assert.equal(s.lines[1], 'cd');
});

test('INSERT preserves indentation on Enter', () => {
  const s = createState('  hello');
  press(s, 'A', 'enter', 'escape');
  assert.equal(s.lines[1].slice(0, 2), '  ');
});

// ── editing operators ─────────────────────────────────────────────────────────

test('x deletes char under cursor', () => {
  const s = createState('abc');
  s.cursor.col = 1;
  press(s, 'x');
  assert.equal(getText(s), 'ac');
});

test('dd deletes line', () => {
  const s = createState('first\nsecond\nthird');
  press(s, 'j', 'd', 'd');
  assert.equal(s.lines.length, 2);
  assert.equal(s.lines[0], 'first');
  assert.equal(s.lines[1], 'third');
});

test('dw deletes word', () => {
  const s = createState('hello world');
  press(s, 'd', 'w');
  assert.equal(getText(s).trimStart().startsWith('world') || getText(s).startsWith('world'), true);
});

test('D deletes to end of line', () => {
  const s = createState('hello world');
  s.cursor.col = 5;
  press(s, 'D');
  assert.equal(getText(s), 'hello');
});

test('yy yanks line and p pastes below', () => {
  const s = createState('abc\ndef');
  press(s, 'y', 'y', 'p');
  assert.equal(s.lines[0], 'abc');
  assert.equal(s.lines[1], 'abc');
  assert.equal(s.lines[2], 'def');
});

test('cc replaces line content and enters INSERT', () => {
  const s = createState('hello');
  press(s, 'c', 'c');
  assert.equal(s.mode, 'INSERT');
  assert.equal(s.lines[0], '');
});

test('r replaces single character', () => {
  const s = createState('abc');
  press(s, 'r', 'x');
  assert.equal(getText(s), 'xbc');
});

test('J joins next line', () => {
  const s = createState('foo\nbar');
  press(s, 'J');
  assert.equal(getText(s), 'foo bar');
});

test('~ toggles case', () => {
  const s = createState('aB');
  press(s, '~');
  assert.equal(s.lines[0][0], 'A');
  press(s, '~');
  assert.equal(s.lines[0][1], 'b');
});

test('u undoes and Ctrl-r redoes', () => {
  const s = createState('hello');
  press(s, 'x');
  assert.equal(getText(s), 'ello');
  press(s, 'u');
  assert.equal(getText(s), 'hello');
  press(s, 'C-r');
  assert.equal(getText(s), 'ello');
});

test('>> indents line', () => {
  const s = createState('hello');
  press(s, '>', '>');
  assert.equal(s.lines[0].startsWith('  '), true);
});

test('<< de-indents line', () => {
  const s = createState('  hello');
  press(s, '<', '<');
  assert.equal(s.lines[0], 'hello');
});

// ── visual mode ───────────────────────────────────────────────────────────────

test('v enters VISUAL mode', () => {
  const s = createState('hello');
  press(s, 'v');
  assert.equal(s.mode, 'VISUAL');
  press(s, 'escape');
  assert.equal(s.mode, 'NORMAL');
});

test('V enters VISUAL_LINE mode', () => {
  const s = createState('hello\nworld');
  press(s, 'V');
  assert.equal(s.mode, 'VISUAL_LINE');
});

test('visual d deletes selection', () => {
  const s = createState('hello');
  press(s, 'v', 'l', 'l', 'd');
  assert.equal(s.mode, 'NORMAL');
  assert.equal(getText(s), 'lo');
});

// ── search ────────────────────────────────────────────────────────────────────

test('applySearch jumps to match', () => {
  const s = createState('foo\nbar\nfoo again');
  applySearch(s, 'foo', 1);
  // From row 0, forward search finds next foo on row 2
  assert.equal(s.cursor.row, 2);
});

test('n repeats search forward', () => {
  const s = createState('a\na\na');
  applySearch(s, 'a', 1);
  press(s, 'n');
  assert.ok(s.cursor.row > 0);
});

// ── substitute ────────────────────────────────────────────────────────────────

test('applySubstitute replaces globally', () => {
  const s = createState('foo foo foo');
  applySubstitute(s, 'foo', 'bar', 'g');
  assert.equal(getText(s), 'bar bar bar');
});

// ── command mode ──────────────────────────────────────────────────────────────

test(': mode accumulates command buffer', () => {
  const s = createState('');
  press(s, ':');
  assert.equal(s.mode, 'COMMAND');
  pressStr(s, 'w');
  assert.equal(s.commandBuf, 'w');
  press(s, 'escape');
  assert.equal(s.mode, 'NORMAL');
});

test(':w returns save action', () => {
  const s = createState('hello');
  press(s, ':');
  pressStr(s, 'w');
  const action = handleKey(s, 'enter', '');
  assert.equal(action?.type, 'save');
});

test(':q returns quit action', () => {
  const s = createState('');
  press(s, ':');
  pressStr(s, 'q');
  const action = handleKey(s, 'enter', '');
  assert.equal(action?.type, 'quit');
});

test(':set nu and :set nonu return setLineNumbers actions', () => {
  for (const [cmd, expected] of [['set nu', true], ['set nonu', false], ['set number', true], ['set nonumber', false]]) {
    const s = createState('');
    press(s, ':');
    pressStr(s, cmd);
    const action = handleKey(s, 'enter', '');
    assert.equal(action?.type, 'setLineNumbers');
    assert.equal(action?.value, expected);
  }
});

test(':set nu! returns toggle (no value)', () => {
  const s = createState('');
  press(s, ':');
  pressStr(s, 'set nu!');
  const action = handleKey(s, 'enter', '');
  assert.equal(action?.type, 'setLineNumbers');
  assert.equal(action?.value, undefined);
});

// ── f/t find-char ─────────────────────────────────────────────────────────────

test('f moves to char on line', () => {
  const s = createState('hello world');
  press(s, 'f', 'w');
  assert.equal(s.cursor.col, 6);
});

test('t moves till char on line', () => {
  const s = createState('hello world');
  press(s, 't', 'w');
  assert.equal(s.cursor.col, 5);
});

// ── marks ──────────────────────────────────────────────────────────────────────

test('m sets mark and backtick jumps to it', () => {
  const s = createState('abc\ndef\nghi');
  press(s, 'j', 'l'); // row 1, col 1
  press(s, 'm', 'a');
  press(s, 'k', 'h'); // back to 0,0
  press(s, "'", 'a');
  assert.equal(s.cursor.row, 1);
});

// ── % bracket matching ────────────────────────────────────────────────────────

test('% jumps to matching bracket', () => {
  const s = createState('(hello)');
  press(s, '%');
  assert.equal(s.cursor.col, 6); // closing )
  press(s, '%');
  assert.equal(s.cursor.col, 0); // back to opening (
});
