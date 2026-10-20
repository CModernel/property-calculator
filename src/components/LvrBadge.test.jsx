// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import LvrBadge from './LvrBadge';
import { classifyLvr, LVR_BANDS } from '../calculations/classifyLvr';
import { fakePopoverLayout, restorePopoverLayout } from '../test/popoverLayout';

describe('LvrBadge', () => {
  it('renders the correct symbol and aria-label for a given lvr', () => {
    render(<LvrBadge lvr={85} />);
    const classification = classifyLvr(85);
    const button = screen.getByRole('button', { name: `LVR risk: ${classification.summary} (${classification.band})` });
    expect(button).toHaveTextContent(classification.symbol);
  });

  it('highlights only the row matching the current band in the tooltip table', () => {
    render(<LvrBadge lvr={85} />);
    const currentBand = classifyLvr(85);
    const highlightedRow = screen.getByText(currentBand.band).closest('tr');
    expect(highlightedRow).toHaveClass('bg-gray-100');

    for (const band of LVR_BANDS) {
      if (band === currentBand) continue;
      const row = screen.getByText(band.band).closest('tr');
      expect(row).not.toHaveClass('bg-gray-100');
    }
  });

  it('opens the tooltip when tapped and closes again when clicking outside (TODO-114 touch fallback)', () => {
    render(<LvrBadge lvr={85} />);
    const button = screen.getByRole('button', { name: /^LVR risk:/ });
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveClass('invisible');

    fireEvent.click(button);
    expect(tooltip).toHaveClass('visible');

    fireEvent.click(document.body);
    expect(tooltip).toHaveClass('invisible');
  });

  // TODO-179/186: the popover is `position: fixed`, so no overflow-x-auto
  // table can clip it (TODO-186), and it is placed from its wrapper's rect,
  // kept 8px inside the viewport near a window edge (TODO-179).
  describe('placement (TODO-179/186)', () => {
    afterEach(restorePopoverLayout);

    it('is fixed-positioned, not absolute, so an overflow container cannot clip it', () => {
      render(<LvrBadge lvr={65} />);
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
      render(<LvrBadge lvr={65} />);
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
      render(<LvrBadge lvr={65} />);
      expect(screen.getByRole('tooltip').style.left).toBe('282px');
      layout.anchor = { left: 10, top: 100, width: 20, height: 16 };
      act(() => reveal());
      expect(screen.getByRole('tooltip').style.left).toBe('8px');
    });

    it('re-measures when the window is resized', () => {
      const layout = fakePopoverLayout({ anchor: { left: 10, top: 100, width: 20, height: 16 } });
      render(<LvrBadge lvr={65} />);
      layout.anchor = { left: 400, top: 100, width: 20, height: 16 };
      act(() => { window.dispatchEvent(new Event('resize')); });
      expect(screen.getByRole('tooltip').style.left).toBe('282px');
    });
  });
});
