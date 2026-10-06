import { vi } from 'vitest';

// TODO-179: jsdom has no layout, so a tooltip popover's rect is faked the way a
// browser reports it - its natural spot plus any margin-left already applied.
export function fakePopoverLayout(natural) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
    if (this.getAttribute('role') !== 'tooltip') return { left: 0, right: 0, width: 0 };
    const left = natural.left + (parseFloat(this.style.marginLeft) || 0);
    return { left, right: left + natural.width, width: natural.width };
  });
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1000 });
}

export function restorePopoverLayout() {
  vi.restoreAllMocks();
  delete document.documentElement.clientWidth;
}
