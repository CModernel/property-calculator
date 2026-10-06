import { useRef, useLayoutEffect, useCallback } from 'react';

// TODO-179: InfoTooltip and LvrBadge centre their popover on the "?" button
// (left-1/2 -translate-x-1/2) and nothing kept it on screen, so a button near
// a window edge - or on a phone - cut off the popover's first or last ~64px.
// This measures the popover and returns the horizontal shift that brings it
// back inside the viewport, written straight onto the popover as a
// margin-left - which moves an absolutely positioned box without fighting the
// translate. Written to the DOM rather than through React state: it is pure
// layout, owned by this hook alone (the components must not set `style` on the
// popover), so there is no render to wait for and nothing to re-render.
//
// The popover is shown by CSS alone (hover / focus-within) plus the tap
// toggle, so there is no "open" moment to measure at - but it is only
// `visibility: hidden` while closed, which keeps its layout, so it can be
// measured whenever geometry may have changed: on mount, on resize, and just
// before it is revealed (`remeasure`, wired to the wrapper's hover/focus/click).
const VIEWPORT_MARGIN = 8;

export function useTooltipViewportShift() {
  const popoverRef = useRef(null);

  const remeasure = useCallback(() => {
    const el = popoverRef.current;
    // clientWidth excludes a vertical scrollbar, innerWidth doesn't - using the
    // latter could leave the popover's edge underneath it. 0 means there is
    // nothing to measure against (no layout), so leave the popover alone.
    const viewport = document.documentElement.clientWidth;
    if (!el || !(viewport > 0)) return;

    const rect = el.getBoundingClientRect();
    // display:none or a detached node reports an all-zero rect, which would
    // read as "clipped by the left edge" and shift by the margin.
    if (rect.width === 0) return;
    // The shift to take back out is read from the DOM, never remembered
    // separately: a remembered value can disagree with what the box actually
    // has (StrictMode's double effect in dev used to double it this way).
    const applied = parseFloat(el.style.marginLeft) || 0;
    const naturalLeft = rect.left - applied;
    const naturalRight = rect.right - applied;

    let next = 0;
    if (naturalRight > viewport - VIEWPORT_MARGIN) next = viewport - VIEWPORT_MARGIN - naturalRight;
    // Applied second so it wins when the popover is wider than the viewport:
    // the start of the text matters more than the end.
    if (naturalLeft + next < VIEWPORT_MARGIN) next = VIEWPORT_MARGIN - naturalLeft;

    el.style.marginLeft = `${next}px`;
  }, []);

  useLayoutEffect(() => {
    remeasure();
    window.addEventListener('resize', remeasure);
    return () => window.removeEventListener('resize', remeasure);
  }, [remeasure]);

  return { popoverRef, remeasure };
}
