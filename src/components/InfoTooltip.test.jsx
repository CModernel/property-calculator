// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import InfoTooltip from './InfoTooltip';
import { fakePopoverLayout, restorePopoverLayout } from '../test/popoverLayout';

describe('InfoTooltip', () => {
  it('renders the trigger button with the given aria-label and the tooltip content', () => {
    render(<InfoTooltip label="What does this do?">Explanation text.</InfoTooltip>);
    expect(screen.getByRole('button', { name: 'What does this do?' })).toBeInTheDocument();
    expect(screen.getByText('Explanation text.')).toBeInTheDocument();
  });

  it('is closed by default and opens when the trigger is clicked (TODO-114 touch fallback)', () => {
    render(<InfoTooltip label="What does this do?">Explanation text.</InfoTooltip>);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveClass('invisible');

    fireEvent.click(screen.getByRole('button', { name: 'What does this do?' }));
    expect(tooltip).toHaveClass('visible');
  });

  it('closes again when clicking outside', () => {
    render(<InfoTooltip label="What does this do?">Explanation text.</InfoTooltip>);
    fireEvent.click(screen.getByRole('button', { name: 'What does this do?' }));
    expect(screen.getByRole('tooltip')).toHaveClass('visible');

    fireEvent.click(document.body);
    expect(screen.getByRole('tooltip')).toHaveClass('invisible');
  });

  it('clicking the trigger again toggles it back closed, undisturbed by the outside-click handler', () => {
    render(<InfoTooltip label="What does this do?">Explanation text.</InfoTooltip>);
    const button = screen.getByRole('button', { name: 'What does this do?' });

    fireEvent.click(button);
    expect(screen.getByRole('tooltip')).toHaveClass('visible');

    fireEvent.click(button);
    expect(screen.getByRole('tooltip')).toHaveClass('invisible');
  });

  // TODO-179/186: the popover is `position: fixed`, so no overflow-x-auto
  // table can clip it (TODO-186), and it is placed from its wrapper's rect,
  // kept 8px inside the viewport near a window edge (TODO-179).
  describe('placement (TODO-179/186)', () => {
    afterEach(restorePopoverLayout);

    it('is fixed-positioned, not absolute, so an overflow container cannot clip it', () => {
      render(<InfoTooltip label="What does this do?">Explanation text.</InfoTooltip>);
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('fixed');
      expect(tooltip).not.toHaveClass('absolute');
      // A fixed box taller than the viewport could never be scrolled into
      // view, so it scrolls inside itself instead.
      expect(tooltip).toHaveClass('overflow-y-auto');
      expect(tooltip.className).toMatch(/max-h-\[calc\(100vh-1rem\)\]/);
    });

    it('keeps the popover inside the viewport near the left edge', () => {
      fakePopoverLayout({ anchor: { left: 10, top: 100, width: 20, height: 16 } });
      render(<InfoTooltip label="What does this do?">Explanation text.</InfoTooltip>);
      expect(screen.getByRole('tooltip').style.left).toBe('8px');
    });

    // Layout can change without a resize (fonts loading, a wider LVR figure,
    // content reflow), so every way of revealing the popover re-measures.
    it.each([
      ['hovering the wrapper', () => fireEvent.mouseEnter(screen.getByRole('button').parentElement)],
      ['focusing the button', () => fireEvent.focus(screen.getByRole('button'))],
      ['tapping the button', () => fireEvent.click(screen.getByRole('button'))],
    ])('re-measures when %s', (_label, reveal) => {
      const layout = fakePopoverLayout();
      render(<InfoTooltip label="What does this do?">Explanation text.</InfoTooltip>);
      expect(screen.getByRole('tooltip').style.left).toBe('282px');
      layout.anchor = { left: 10, top: 100, width: 20, height: 16 };
      act(() => reveal());
      expect(screen.getByRole('tooltip').style.left).toBe('8px');
    });

    it('re-measures when the window is resized', () => {
      const layout = fakePopoverLayout({ anchor: { left: 10, top: 100, width: 20, height: 16 } });
      render(<InfoTooltip label="What does this do?">Explanation text.</InfoTooltip>);
      layout.anchor = { left: 400, top: 100, width: 20, height: 16 };
      act(() => { window.dispatchEvent(new Event('resize')); });
      expect(screen.getByRole('tooltip').style.left).toBe('282px');
    });
  });
});
