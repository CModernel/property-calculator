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

  // TODO-179: a "?" button flush with the left margin used to push the centred
  // popover to -64px and cut off the start of every line.
  describe('near a window edge (TODO-179)', () => {
    afterEach(restorePopoverLayout);

    it('shifts the popover back inside the viewport', () => {
      fakePopoverLayout({ left: -64, width: 256 });
      render(<LvrBadge lvr={65} />);
      expect(screen.getByRole('tooltip').style.marginLeft).toBe('72px');
    });

    // Layout can change without a resize (fonts loading, a wider LVR figure,
    // content reflow), so every way of revealing the popover re-measures.
    it.each([
      ['hovering the wrapper', () => fireEvent.mouseEnter(screen.getByRole('button').parentElement)],
      ['focusing the button', () => fireEvent.focus(screen.getByRole('button'))],
      ['tapping the button', () => fireEvent.click(screen.getByRole('button'))],
    ])('re-measures when %s', (_label, reveal) => {
      fakePopoverLayout({ left: 300, width: 256 });
      render(<LvrBadge lvr={65} />);
      expect(screen.getByRole('tooltip').style.marginLeft).toBe('0px');
      fakePopoverLayout({ left: -64, width: 256 });
      act(() => reveal());
      expect(screen.getByRole('tooltip').style.marginLeft).toBe('72px');
    });

    it('re-measures when the window is resized', () => {
      fakePopoverLayout({ left: -64, width: 256 });
      render(<LvrBadge lvr={65} />);
      fakePopoverLayout({ left: 300, width: 256 });
      act(() => { window.dispatchEvent(new Event('resize')); });
      expect(screen.getByRole('tooltip').style.marginLeft).toBe('0px');
    });
  });
});
