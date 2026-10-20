import { useRef, useLayoutEffect, useCallback } from 'react';

// TODO-179/186: places a tooltip popover (InfoTooltip, LvrBadge) on screen.
// The popover is `position: fixed` (TODO-186). It used to be `absolute` under
// its "?" button, so an `overflow-x-auto` table wrapper clipped it - overflow-x
// forces overflow-y too, cutting it at the bottom and hiding its first pixels
// near the left edge - and every hidden popover still counted as scrollable
// overflow (a 78px blank strip at the page's end, TODO-191). A fixed box is
// clipped by no overflow ancestor and adds nothing to the page's scroll area.
// It stays in place in the DOM (no portal), so the CSS hover/focus-within
// reveal, the tap toggle's outside-click ref and `within(row)` queries all
// still see it inside its wrapper.
//
// Being fixed, it must be told where to go: centred 8px below its anchor (the
// wrapper span), kept 8px inside the viewport horizontally (the left edge wins
// when it's wider than the viewport - the start of the text matters more), and
// flipped above the anchor when it would cross the bottom edge and there is
// more room above (the viewport now clips it and scrolling can't reveal it),
// and pulled back inside the viewport when it is taller than either side.
// Written straight to style.left/top, never React state: pure layout, owned by
// this hook alone (the components must not set `style` on the popover).
//
// The popover is only `visibility: hidden` while closed, which keeps its
// layout, so it can be measured on mount, on resize and just before it is
// revealed (`remeasure`, wired to the wrapper's hover/focus/click). While it is
// actually visible it also follows its anchor on scroll - a fixed box would
// otherwise stay put while its button scrolls away.
const VIEWPORT_MARGIN = 8;
const GAP = 8;

// A transformed/filtered/... ancestor becomes the containing block of a fixed
// descendant (the Loan Simulation's backdrop-blur panels, for one), so
// coordinates are written relative to it rather than to the viewport.
function containingBlockOf(el) {
  for (let node = el.parentElement; node && node !== document.documentElement; node = node.parentElement) {
    const s = getComputedStyle(node);
    if ((s.transform && s.transform !== 'none')
      || (s.filter && s.filter !== 'none')
      || (s.backdropFilter && s.backdropFilter !== 'none')
      || (s.perspective && s.perspective !== 'none')
      || /paint|layout|strict|content/.test(s.contain || '')
      || /transform|filter|perspective/.test(s.willChange || '')) {
      return node;
    }
  }
  return null;
}

export function useTooltipViewportShift() {
  const popoverRef = useRef(null);

  const remeasure = useCallback(() => {
    const el = popoverRef.current;
    const anchorEl = el?.parentElement;
    // clientWidth/Height exclude scrollbars, innerWidth/Height don't. 0 means
    // there is nothing to measure against (no layout), so leave it alone.
    const viewportW = document.documentElement.clientWidth;
    const viewportH = document.documentElement.clientHeight;
    if (!el || !anchorEl || !(viewportW > 0)) return;

    const popover = el.getBoundingClientRect();
    // display:none or a detached node reports an all-zero rect.
    if (popover.width === 0) return;
    const anchor = anchorEl.getBoundingClientRect();

    let left = anchor.left + anchor.width / 2 - popover.width / 2;
    if (left + popover.width > viewportW - VIEWPORT_MARGIN) left = viewportW - VIEWPORT_MARGIN - popover.width;
    // Applied second so it wins when the popover is wider than the viewport.
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

    let top = anchor.bottom + GAP;
    const roomBelow = viewportH - VIEWPORT_MARGIN - anchor.bottom;
    const roomAbove = anchor.top - VIEWPORT_MARGIN;
    if (viewportH > 0 && top + popover.height > viewportH - VIEWPORT_MARGIN && roomAbove > roomBelow) {
      top = anchor.top - GAP - popover.height;
    }
    // Taller than the room on either side: pulled back inside the viewport
    // (the top margin wins). The components cap its height at the viewport and
    // let it scroll inside itself, since nothing can scroll a fixed box's cut
    // part into view.
    if (viewportH > 0) {
      top = Math.min(top, viewportH - VIEWPORT_MARGIN - popover.height);
      top = Math.max(top, VIEWPORT_MARGIN);
    }

    // Absolute coordinates every time, so re-measuring (or StrictMode's double
    // effect) can never compound a previous placement.
    const cb = containingBlockOf(el);
    const origin = cb ? cb.getBoundingClientRect() : { left: 0, top: 0 };
    el.style.left = `${left - origin.left}px`;
    el.style.top = `${top - origin.top}px`;
  }, []);

  useLayoutEffect(() => {
    remeasure();
    let frame = null;
    const raf = window.requestAnimationFrame ?? ((cb) => setTimeout(cb, 16));
    const caf = window.cancelAnimationFrame ?? clearTimeout;
    // Capture phase, so a scroll inside any container (the overflow-x-auto
    // tables) is seen too. Only a visible popover is measured: dozens of
    // closed tooltips are mounted at once.
    const onScroll = () => {
      const el = popoverRef.current;
      if (!el || frame !== null || getComputedStyle(el).visibility !== 'visible') return;
      frame = raf(() => { frame = null; remeasure(); });
    };
    window.addEventListener('resize', remeasure);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', onScroll, { capture: true });
      if (frame !== null) caf(frame);
    };
  }, [remeasure]);

  return { popoverRef, remeasure };
}
