// @vitest-environment jsdom
import '../test/reactTestSetup';
import { StrictMode } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useTooltipViewportShift } from './useTooltipViewportShift';
import { fakePopoverLayout, restorePopoverLayout } from '../test/popoverLayout';

// TODO-186: the popover is `position: fixed`, placed by the hook from its
// wrapper's (the anchor's) rect, so no overflow container can clip it. jsdom
// has no layout; test/popoverLayout.js fakes the rects (viewport 1000 x 800,
// anchor 400,100 20x16, popover 256x120 unless a test says otherwise).
afterEach(restorePopoverLayout);

function Harness({ hidden = false, transformed = false }) {
  const { popoverRef, remeasure } = useTooltipViewportShift();
  const tooltip = (
    <span>
      <div role="tooltip" ref={popoverRef} style={hidden ? { visibility: 'hidden' } : undefined} />
    </span>
  );
  return (
    <div>
      {transformed ? <div data-containing-block="" style={{ transform: 'translateX(0px)' }}>{tooltip}</div> : tooltip}
      <button type="button" onClick={remeasure}>measure</button>
    </div>
  );
}

const pos = () => {
  const { left, top } = screen.getByRole('tooltip', { hidden: true }).style;
  return { left, top };
};

describe('useTooltipViewportShift (fixed popover, TODO-186)', () => {
  it('places the popover centred, 8px below its anchor', () => {
    fakePopoverLayout();
    render(<Harness />);
    // Anchor centre 410 - half the width 128 = 282; anchor bottom 116 + 8.
    expect(pos()).toEqual({ left: '282px', top: '124px' });
  });

  it('keeps an 8px margin from the left edge (TODO-179)', () => {
    fakePopoverLayout({ anchor: { left: 10, top: 100, width: 20, height: 16 } });
    render(<Harness />);
    expect(pos().left).toBe('8px');
  });

  it('keeps an 8px margin from the right edge (TODO-179)', () => {
    fakePopoverLayout({ anchor: { left: 980, top: 100, width: 20, height: 16 } });
    render(<Harness />);
    // 1000 - 8 - 256.
    expect(pos().left).toBe('736px');
  });

  it('keeps the left edge visible when the popover is wider than the viewport', () => {
    fakePopoverLayout({ popover: { width: 1200, height: 120 } });
    render(<Harness />);
    expect(pos().left).toBe('8px');
  });

  // With `fixed`, the viewport's bottom edge clips and scrolling can't reveal
  // the rest - so near the bottom the popover opens above its anchor.
  it('flips above the anchor when there is no room below', () => {
    fakePopoverLayout({ anchor: { left: 400, top: 700, width: 20, height: 16 } });
    render(<Harness />);
    // 700 - 8 - 120.
    expect(pos().top).toBe('572px');
  });

  it('stays below when it fits, even close to the bottom', () => {
    fakePopoverLayout({ anchor: { left: 400, top: 640, width: 20, height: 16 } });
    render(<Harness />);
    // 656 + 8 + 120 = 784 <= 792.
    expect(pos().top).toBe('664px');
  });

  // Taller than the room on either side (two tooltips measured 530-610px in a
  // 900px window): with `fixed` nothing can scroll the cut part into view, so
  // it is pulled back inside the viewport (and scrolls inside itself, via the
  // components' max-height).
  it('pulls a popover taller than either side back inside the viewport', () => {
    fakePopoverLayout({ anchor: { left: 400, top: 300, width: 20, height: 16 }, popover: { width: 256, height: 700 } });
    render(<Harness />);
    // Stays below (more room there) but is lifted to 800 - 8 - 700.
    expect(pos().top).toBe('92px');
  });

  it('never places a flipped popover above the top edge', () => {
    fakePopoverLayout({ anchor: { left: 400, top: 400, width: 20, height: 16 }, popover: { width: 256, height: 700 } });
    render(<Harness />);
    // Flips above (more room there), clamped to the 8px margin.
    expect(pos().top).toBe('8px');
  });

  // A transformed (or filtered, backdrop-filtered...) ancestor becomes the
  // containing block of a fixed descendant, so its offset is taken back out.
  it('writes coordinates relative to a transformed ancestor', () => {
    const layout = fakePopoverLayout();
    layout.containingBlock = { left: 100, top: 50 };
    render(<Harness transformed />);
    expect(pos()).toEqual({ left: '182px', top: '74px' });
  });

  it('re-measures on window resize', () => {
    const layout = fakePopoverLayout();
    render(<Harness />);
    layout.anchor = { left: 600, top: 100, width: 20, height: 16 };
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(pos().left).toBe('482px');
  });

  it('follows its anchor on scroll while it is visible', async () => {
    const layout = fakePopoverLayout();
    render(<Harness />);
    layout.anchor = { left: 400, top: 300, width: 20, height: 16 };
    await act(async () => {
      document.dispatchEvent(new Event('scroll'));
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(pos().top).toBe('324px');
  });

  // ~50 closed tooltips are mounted at once; a scroll must not measure them.
  it('ignores scroll while the popover is hidden', async () => {
    const layout = fakePopoverLayout();
    render(<Harness hidden />);
    expect(pos().top).toBe('124px');
    layout.anchor = { left: 400, top: 300, width: 20, height: 16 };
    await act(async () => {
      document.dispatchEvent(new Event('scroll'));
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(pos().top).toBe('124px');
  });

  it('re-measures when asked (reveal), from absolute coordinates every time', () => {
    const layout = fakePopoverLayout();
    render(<Harness />);
    layout.anchor = { left: 10, top: 100, width: 20, height: 16 };
    fireEvent.click(screen.getByRole('button', { name: 'measure' }));
    fireEvent.click(screen.getByRole('button', { name: 'measure' }));
    expect(pos().left).toBe('8px');
  });

  it('is idempotent under StrictMode', () => {
    fakePopoverLayout();
    render(<StrictMode><Harness /></StrictMode>);
    expect(pos()).toEqual({ left: '282px', top: '124px' });
  });

  it('ignores a popover with no layout (display: none)', () => {
    fakePopoverLayout({ popover: { width: 0, height: 0 } });
    render(<Harness />);
    expect(pos()).toEqual({ left: '', top: '' });
  });

  it('does nothing when the viewport has no measurable width', () => {
    fakePopoverLayout();
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 0 });
    render(<Harness />);
    expect(pos()).toEqual({ left: '', top: '' });
  });
});

