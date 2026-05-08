import { highlight, supportsLanguage } from 'cli-highlight';
import chalk from 'chalk';

// chalk 4 (cjs) — expose named colors / modifiers as functions.
// Color name aliases: bright<Color> → <color>Bright (chalk's naming).
const COLOR_ALIASES = {
  brightblack:   'blackBright',
  brightred:     'redBright',
  brightgreen:   'greenBright',
  brightyellow:  'yellowBright',
  brightblue:    'blueBright',
  brightmagenta: 'magentaBright',
  brightcyan:    'cyanBright',
  brightwhite:   'whiteBright',
  gray:          'gray',
  grey:          'gray',
};

// Convert a string color/modifier spec to a chalk function.
// Examples: "blue", "bold blue", "italic", "brightcyan".
// Returns null if nothing valid was found.
export function colorFn(spec) {
  if (!spec || typeof spec !== 'string') return null;
  const tokens = spec.trim().split(/\s+/);
  let style = chalk;
  for (const t of tokens) {
    const key = COLOR_ALIASES[t.toLowerCase()] || t;
    if (typeof style[key] === 'function') style = style[key];
    else return null;
  }
  return typeof style === 'function' ? style : null;
}

// Map file extensions to highlight.js languages. Skewed toward web work —
// HTML/CSS/JS/TS/JSX/TSX/Vue/Svelte/JSON5 etc. all get distinct grammars.
const EXT_TO_LANG = {
  // JS family
  '.js':   'javascript',
  '.mjs':  'javascript',
  '.cjs':  'javascript',
  '.jsx':  'javascript',
  '.ts':   'typescript',
  '.tsx':  'typescript',
  '.mts':  'typescript',
  '.cts':  'typescript',

  // Markup / templates
  '.html':    'xml',
  '.htm':     'xml',
  '.xhtml':   'xml',
  '.xml':     'xml',
  '.svg':     'xml',
  '.vue':     'xml',
  '.svelte':  'xml',
  '.astro':   'xml',
  '.hbs':     'handlebars',
  '.handlebars': 'handlebars',
  '.ejs':     'xml',

  // Styles
  '.css':   'css',
  '.scss':  'scss',
  '.sass':  'scss',
  '.less':  'less',

  // Data / config
  '.json':  'json',
  '.json5': 'json',
  '.jsonc': 'json',
  '.yml':   'yaml',
  '.yaml':  'yaml',
  '.toml':  'ini',
  '.ini':   'ini',

  // Docs
  '.md':       'markdown',
  '.markdown': 'markdown',

  // Shell
  '.sh':    'bash',
  '.bash':  'bash',
  '.zsh':   'bash',
  '.fish':  'bash',
  '.ps1':   'powershell',

  // Other languages
  '.py':    'python',
  '.rb':    'ruby',
  '.go':    'go',
  '.rs':    'rust',
  '.java':  'java',
  '.kt':    'kotlin',
  '.swift': 'swift',
  '.c':     'c',
  '.h':     'c',
  '.cpp':   'cpp',
  '.hpp':   'cpp',
  '.cc':    'cpp',
  '.hh':    'cpp',
  '.cs':    'csharp',
  '.php':   'php',
  '.r':     'r',
  '.lua':   'lua',
  '.sql':   'sql',
  '.graphql': 'graphql',
  '.gql':     'graphql',
  '.proto':   'protobuf',
  '.dockerfile': 'dockerfile',
  dockerfile:    'dockerfile',  // matches lowercased basename "dockerfile"
};

export function languageFor(filePath) {
  if (!filePath) return null;
  const lower = filePath.toLowerCase();
  // Check exact basename first (Dockerfile, etc.)
  const base = lower.split('/').pop();
  if (EXT_TO_LANG[base]) return EXT_TO_LANG[base];
  for (const [ext, lang] of Object.entries(EXT_TO_LANG)) {
    if (ext.startsWith('.') && lower.endsWith(ext)) return lang;
  }
  return null;
}

export function highlightLines(text, filePath, theme) {
  const lang = languageFor(filePath);
  if (!lang || !supportsLanguage(lang)) return text;
  try {
    return highlight(text, {
      language: lang,
      ignoreIllegals: true,
      theme: themeFor(theme),
    });
  } catch {
    return text;
  }
}

// cli-highlight accepts a theme object whose keys are highlight.js scope
// names. Each value can be a chalk-style function, a string color name, or
// any chalk modifier ("bold blue", etc.). highlight.js emits richer scopes
// for web files than just keyword/string/number — covering tags, attrs,
// selectors, builtin types, and so on. We map every interesting scope to a
// theme entry so the output is colourful and structured rather than three
// flavours of grey.
function themeFor(theme) {
  if (!theme?.syntax) return undefined;
  const s = theme.syntax;

  // Helper: pick the first key that resolves to a valid chalk function.
  // cli-highlight expects functions (not strings), so we run each through
  // colorFn() and skip any that don't resolve.
  const pick = (...keys) => {
    for (const k of keys) {
      const v = s[k];
      if (v == null) continue;
      const fn = colorFn(v);
      if (fn) return fn;
    }
    return undefined;
  };

  const out = {
    // Generic
    keyword:        pick('keyword'),
    built_in:       pick('builtin', 'built_in', 'type', 'keyword'),
    type:           pick('type', 'builtin'),
    literal:        pick('literal', 'number', 'keyword'),
    number:         pick('number'),
    string:         pick('string'),
    regexp:         pick('regexp', 'string'),
    symbol:         pick('symbol', 'string'),
    comment:        pick('comment'),
    doctag:         pick('doctag', 'comment'),
    meta:           pick('meta', 'comment'),
    'meta-keyword': pick('keyword'),
    'meta-string':  pick('string'),

    // Functions & classes
    function:           pick('function'),
    'title.function':   pick('function'),
    'title.class':      pick('type'),
    'title.class.inherited.': pick('type'),
    title:              pick('function'),
    params:             pick('parameter', 'variable', 'foreground'),

    // Markup / HTML
    tag:                pick('tag', 'keyword'),
    name:               pick('tagName', 'tag', 'keyword'),
    attr:               pick('attribute', 'attr', 'function'),
    attribute:          pick('attribute', 'attr', 'function'),
    'meta .attr':       pick('attribute', 'attr', 'function'),

    // CSS
    'selector-tag':     pick('tag', 'keyword'),
    'selector-id':      pick('selectorId', 'function'),
    'selector-class':   pick('selectorClass', 'function'),
    'selector-attr':    pick('attribute'),
    'selector-pseudo':  pick('builtin', 'type'),
    property:           pick('attribute', 'attr'),

    // Variables
    variable:           pick('variable', 'foreground'),
    'variable.language':pick('builtin', 'type'),
    'variable.constant':pick('literal', 'number'),

    // Diff
    addition:           pick('addition', 'string'),
    deletion:           pick('deletion', 'number'),

    // Markdown
    bullet:             pick('bullet', 'function'),
    quote:              pick('comment'),
    section:            pick('function', 'keyword'),
    emphasis:           'italic',
    strong:             'bold',
    code:               pick('string'),
    link:               pick('string'),
  };
  // Strip undefineds so cli-highlight falls back to its default for unset scopes.
  for (const k of Object.keys(out)) if (out[k] == null) delete out[k];
  return out;
}
