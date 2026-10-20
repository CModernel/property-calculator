import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../tailwind.config.js';

// TODO-191: scrolling past the top, or to the bottom of the page, showed a
// white strip in dark mode. Two causes in index.css, both visible only in a
// real browser:
//  1. `html, body { @apply dark:bg-slate-900 }` compiles `dark:` to
//     `.dark html`, which needs a `.dark` ANCESTOR - but the class sits on
//     <html> itself, so html never went dark. The canvas takes html's
//     background, so the overscroll area and everything past the body (a
//     hidden tooltip popover near the page's end stretches the scroll area
//     78px past it) rendered light.
//  2. The page gradient lived on the max-w-7xl root div, so wide screens saw a
//     gradient column with flat sides, and that overflow strip a third colour.
// The gradient now lives on <html>, themed with `html.dark`.
// jsdom doesn't load stylesheets, so this compiles the real file with the
// project's Tailwind config and inspects the output.
async function compile() {
  const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
  const result = await postcss([tailwindcss(tailwindConfig)]).process(css, { from: 'src/index.css' });
  return result.root;
}

function declarationsFor(root, selector) {
  const found = {};
  root.walkRules((rule) => {
    if (rule.selectors.includes(selector)) rule.walkDecls((d) => { found[d.prop] = d.value; });
  });
  return found;
}

describe('page background (TODO-191)', () => {
  it('themes <html> itself with html.dark, not a descendant selector that can never match it', async () => {
    const root = await compile();
    const dark = declarationsFor(root, 'html.dark');
    expect(dark['--tw-gradient-from']).toMatch(/#0f172a/); // slate-900
    expect(dark['--tw-gradient-to']).toBeDefined();

    const selectors = [];
    root.walkRules((rule) => selectors.push(...rule.selectors));
    // `.dark html` is the broken form: html is the element carrying .dark.
    expect(selectors.filter((s) => /\.dark\s+html\b/.test(s))).toEqual([]);
  });

  it('paints the light theme on <html> as a gradient that stays put while the page scrolls', async () => {
    const light = declarationsFor(await compile(), 'html');
    expect(light['background-image']).toMatch(/linear-gradient/);
    expect(light['--tw-gradient-from']).toMatch(/#f8fafc/); // slate-50
    // `fixed` makes it cover the viewport however far the page overscrolls or
    // overflows, so no strip of a different colour can appear.
    expect(light['background-attachment']).toBe('fixed');
  });

  it('leaves <body> transparent so the one gradient shows through', async () => {
    const body = declarationsFor(await compile(), 'body');
    expect(body['background-color']).toBeUndefined();
    expect(body['background-image']).toBeUndefined();
  });
});
