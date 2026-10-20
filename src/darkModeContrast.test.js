import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../tailwind.config.js';
import { chartColors, DARK_LEGEND_TEXT } from './components/chartTheme';

// TODO-192: dark mode had text you could barely read - black text on dark
// cards (anything with no colour class inherits the browser's black, because
// no base text colour was ever set), muted greys at ~3:1, white-on-pastel
// buttons, a dark-blue figure with no dark variant, series-coloured chart
// legends at 2.6:1. A Chrome audit measured the real contrast of every text
// node; this pins the rules that audit led to so they can't creep back.
// (jsdom has no layout or stylesheets, so these are source and compiled-CSS
// rules, not renders.)

function sourceFiles() {
  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.jsx$/.test(path) && !/\.test\./.test(path)) files.push(path);
    }
  })(new URL('.', import.meta.url).pathname);
  return files;
}

// Every string literal in the app that carries Tailwind text classes.
function classStrings({ any = false } = {}) {
  const found = [];
  const literal = /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g;
  for (const file of sourceFiles()) {
    const source = readFileSync(file, 'utf8');
    let match;
    while ((match = literal.exec(source))) {
      const value = match[1] ?? match[2] ?? match[3];
      if (!any && !/\btext-/.test(value)) continue;
      found.push({ file: file.split('/src/')[1], line: source.slice(0, match.index).split('\n').length, tokens: value.split(/\s+/).filter(Boolean), value });
    }
  }
  return found;
}

const describeAll = (rows) => rows.map((r) => `${r.file}:${r.line} ${r.value.slice(0, 70)}`);

// Contrast helpers for the chart-colour checks.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('dark mode text contrast (TODO-192)', () => {
  it('gives every dark-toned text colour a dark: counterpart in the same class list', () => {
    // These shades are for light surfaces; left alone they are near-black (or
    // a mid grey, ~3:1) on the dark cards.
    const needsDarkVariant = /^text-(?:black|gray-(?:500|600|700|800|900)|slate-(?:500|600|700|800|900)|(?:red|green|blue|yellow|cyan|orange|purple|indigo|amber|emerald|teal|violet|pink|rose|sky|lime)-(?:500|600|700|800|900))$/;
    const offenders = classStrings().filter((row) =>
      row.tokens.some((t) => needsDarkVariant.test(t)) && !row.tokens.some((t) => /^dark:text-/.test(t)));
    expect(describeAll(offenders)).toEqual([]);
  });

  it('never uses dark:text-gray-500 / -600, which are about 3:1 on the dark cards', () => {
    const offenders = classStrings().filter((row) => row.tokens.some((t) => /^dark:text-gray-(?:500|600)$/.test(t)));
    expect(describeAll(offenders)).toEqual([]);
  });

  it('never repeats the same grey for both themes (text-gray-400 dark:text-gray-400)', () => {
    // Grey-400 is 2.4:1 on white; the muted pair is text-gray-500 dark:text-gray-400.
    const offenders = classStrings().filter((row) => row.tokens.includes('text-gray-400') && row.tokens.includes('dark:text-gray-400'));
    expect(describeAll(offenders)).toEqual([]);
  });

  it('does not put white text on a light-toned filled button or gradient', () => {
    // white on yellow/green/cyan-500 is 1.9-2.4:1; even -600 is under 4.5:1.
    // yellow/green/cyan/... need 700+; red, blue, indigo, purple, violet, pink
    // and rose only reach 4.5:1 from 600 (red-500 is 3.8:1).
    const light = /^bg-(?:(?:yellow|green|cyan|lime|amber|orange|teal|emerald|sky)-(?:50|100|200|300|400|500|600)|(?:red|blue|indigo|purple|violet|pink|rose)-(?:50|100|200|300|400|500))$/;
    // Gradients count too: from-/to-/via- stops are the surface behind the text.
    const surface = (t) => t.replace(/^(?:from|to|via)-/, 'bg-');
    const offenders = classStrings().filter((row) => row.tokens.includes('text-white') && row.tokens.some((t) => light.test(surface(t))));
    expect(describeAll(offenders)).toEqual([]);
  });

  it('does not lighten a coloured card with a translucent white panel (white text sits on it)', () => {
    // bg-white/20 over indigo-600 is (114,107,234): white text at 75% opacity
    // on it measured 3.1:1. A darkening panel (bg-black/20) reads 6:1+.
    const offenders = classStrings({ any: true }).filter((row) => row.tokens.some((t) => /^bg-white\/(?:[1-4]\d?)$/.test(t)));
    expect(describeAll(offenders)).toEqual([]);
  });

  it('keeps text on the dark red surfaces at red-200, not the 3.6:1 red-400', () => {
    const offenders = classStrings().filter((row) =>
      row.tokens.includes('dark:bg-red-900') && row.tokens.some((t) => /^dark:text-red-(?:300|400|500|600)$/.test(t)));
    expect(describeAll(offenders)).toEqual([]);
  });

  it('sets a base text colour for both themes, so text with no colour class is not the browser black', async () => {
    const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
    const root = (await postcss([tailwindcss(tailwindConfig)]).process(css, { from: 'src/index.css' })).root;
    const colorOf = (selector) => {
      let color;
      root.walkRules((rule) => {
        if (rule.selectors.includes(selector)) rule.walkDecls('color', (d) => { color = d.value; });
      });
      return color;
    };
    expect(colorOf('html')).toBeDefined();
    // gray-200 on the dark gradient.
    expect(colorOf('html.dark')).toMatch(/229 231 235/);
  });

  describe('chart colours on the dark card (#1f2937)', () => {
    const CARD = '#1f2937';

    it('draws every dark-mode series at 3:1 or better', () => {
      for (const [series, hex] of Object.entries(chartColors(true))) {
        expect(contrast(hex, CARD), series).toBeGreaterThanOrEqual(3);
      }
    });

    it('keeps the light-mode series as they were', () => {
      expect(chartColors(false)).toMatchObject({ balance: '#ef4444', offset: '#3b82f6', effective: '#7c3aed' });
    });

    it('prints dark-mode legend text at 4.5:1 or better', () => {
      expect(contrast(DARK_LEGEND_TEXT, CARD)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
