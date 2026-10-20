// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// TODO-190: the header row (title + Simple/Advanced button + theme toggle) did
// not fit a phone. The button group is shrink-0 and the title's own minimum
// width is ~200px, so at 390px and under the row was ~450px wide and the whole
// page scrolled sideways (measured in Chrome: 78px over in Simple, 58px in
// Advanced; fine from 768px up). jsdom has no layout, so this pins the class
// that fixes it - stacking the two groups below the `sm` breakpoint - and the
// min-width escape the title block needs; the real widths were checked in the
// browser.
describe('header layout on narrow screens (TODO-190)', () => {
  const header = () => screen.getByRole('heading', { level: 1 }).closest('div').parentElement;

  it('stacks the title above the buttons below the sm breakpoint, side by side from it', () => {
    render(<App />);
    const classes = header().className.split(/\s+/);
    expect(classes).toContain('flex-col');
    expect(classes).toContain('sm:flex-row');
    // Not also a bare `flex-row`, which would win below sm and undo the stack.
    expect(classes).not.toContain('flex-row');
  });

  it('lets the title block shrink so a long title wraps instead of widening the page', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).closest('div').className.split(/\s+/)).toContain('min-w-0');
  });
});
