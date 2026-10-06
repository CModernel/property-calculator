// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect, vi, afterEach } from 'vitest';
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

  // TODO-179: a "?" button flush with the left margin used to push the centred
  // popover to -64px and cut off the start of every line.
  describe('near a window edge (TODO-179)', () => {
    afterEach(restorePopoverLayout);

    it('shifts the popover back inside the viewport', () => {
      fakePopoverLayout({ left: -64, width: 256 });
      render(<InfoTooltip label="What does this do?">Explanation text.</InfoTooltip>);
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
      render(<InfoTooltip label="What does this do?">Explanation text.</InfoTooltip>);
      expect(screen.getByRole('tooltip').style.marginLeft).toBe('0px');
      fakePopoverLayout({ left: -64, width: 256 });
      act(() => reveal());
      expect(screen.getByRole('tooltip').style.marginLeft).toBe('72px');
    });

    it('re-measures when the window is resized', () => {
      fakePopoverLayout({ left: -64, width: 256 });
      render(<InfoTooltip label="What does this do?">Explanation text.</InfoTooltip>);
      fakePopoverLayout({ left: 300, width: 256 });
      act(() => { window.dispatchEvent(new Event('resize')); });
      expect(screen.getByRole('tooltip').style.marginLeft).toBe('0px');
    });
  });
});
