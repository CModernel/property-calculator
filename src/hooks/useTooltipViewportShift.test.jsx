// @vitest-environment jsdom
import '../test/reactTestSetup';
import { StrictMode } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useTooltipViewportShift } from './useTooltipViewportShift';

// jsdom has no layout, so the popover's rect is faked the way a browser would
// report it: its natural position plus whatever margin-left the hook applied.
let natural;
beforeEach(() => {
  natural = { left: 100, width: 256 };
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
    if (this.getAttribute('role') !== 'tooltip') return { left: 0, right: 0, width: 0 };
    const left = natural.left + (parseFloat(this.style.marginLeft) || 0);
    return { left, right: left + natural.width, width: natural.width };
  });
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1000 });
});
afterEach(() => {
  vi.restoreAllMocks();
  delete document.documentElement.clientWidth;
});

function Harness() {
  const { popoverRef, remeasure } = useTooltipViewportShift();
  return (
    <div>
      <div role="tooltip" ref={popoverRef} />
      <button type="button" onClick={remeasure}>measure</button>
    </div>
  );
}

const marginLeft = () => screen.getByRole('tooltip').style.marginLeft;

describe('useTooltipViewportShift', () => {
  it('leaves a popover that fits alone', () => {
    render(<Harness />);
    expect(marginLeft()).toBe('0px');
  });

  it('shifts a popover clipped by the left edge back to the margin', () => {
    natural = { left: -64, width: 256 };
    render(<Harness />);
    expect(marginLeft()).toBe('72px');
  });

  it('shifts a popover clipped by the right edge back to the margin', () => {
    natural = { left: 800, width: 256 };
    render(<Harness />);
    // Right edge 1056 -> 992 (1000 - 8).
    expect(marginLeft()).toBe('-64px');
  });

  it('measures the natural position, so re-measuring never double-shifts', () => {
    natural = { left: -64, width: 256 };
    render(<Harness />);
    // One re-measure, checked on its own: without taking the applied shift back
    // out it flips to 0, and a second one would flip it back and hide the bug.
    fireEvent.click(screen.getByRole('button', { name: 'measure' }));
    expect(marginLeft()).toBe('72px');
  });

  it('re-measures on window resize, and un-shifts when there is room again', () => {
    natural = { left: -64, width: 256 };
    render(<Harness />);
    expect(marginLeft()).toBe('72px');

    natural = { left: 300, width: 256 };
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(marginLeft()).toBe('0px');
  });

  it('keeps the left edge visible when the popover is wider than the viewport', () => {
    natural = { left: -50, width: 1200 };
    render(<Harness />);
    expect(marginLeft()).toBe('58px');
  });

  // React's dev StrictMode runs the layout effect twice before the first shift
  // is committed; measuring from state/a ref instead of the DOM doubled it.
  it('does not double the shift under StrictMode', () => {
    natural = { left: -64, width: 256 };
    render(<StrictMode><Harness /></StrictMode>);
    expect(marginLeft()).toBe('72px');
  });

  it('ignores a popover with no layout (display: none)', () => {
    natural = { left: 0, width: 0 };
    render(<Harness />);
    // Never written at all.
    expect(marginLeft()).toBe('');
  });

  it('does nothing when the viewport has no measurable width', () => {
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 0 });
    natural = { left: -64, width: 256 };
    render(<Harness />);
    // Never written at all.
    expect(marginLeft()).toBe('');
  });
});
