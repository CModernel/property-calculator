import { vi } from 'vitest';

// TODO-179/186: jsdom has no layout, so the rects are faked the way a browser
// reports them for a `position: fixed` popover:
//  - the anchor is the popover's parent (the tooltip's wrapper span);
//  - the popover sits wherever its style.left/top put it, offset by the rect of
//    an ancestor marked `data-containing-block` (a transformed ancestor makes
//    `fixed` relative to itself instead of the viewport);
//  - the viewport is 1000 x 800.
// Every argument has a default, so a test states only what it is about.
export function fakePopoverLayout({
  anchor = { left: 400, top: 100, width: 20, height: 16 },
  popover = { width: 256, height: 120 },
  containingBlock = { left: 0, top: 0 },
} = {}) {
  const state = { anchor, popover, containingBlock };
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
    const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
    if (this.getAttribute('role') === 'tooltip') {
      const cb = this.closest('[data-containing-block]') ? state.containingBlock : { left: 0, top: 0 };
      const left = cb.left + (parseFloat(this.style.left) || 0);
      const top = cb.top + (parseFloat(this.style.top) || 0);
      return box(left, top, state.popover.width, state.popover.height);
    }
    if (this.querySelector(':scope > [role="tooltip"]')) {
      const a = state.anchor;
      return box(a.left, a.top, a.width, a.height);
    }
    if (this.hasAttribute('data-containing-block')) return box(state.containingBlock.left, state.containingBlock.top, 900, 700);
    return box(0, 0, 0, 0);
  });
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1000 });
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 800 });
  // Lets a test move things between measurements (e.g. scroll the anchor).
  return state;
}

export function restorePopoverLayout() {
  vi.restoreAllMocks();
  delete document.documentElement.clientWidth;
  delete document.documentElement.clientHeight;
}
