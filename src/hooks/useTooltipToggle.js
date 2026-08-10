import { useState, useRef, useEffect } from 'react';

// TODO-114: plain <button> elements don't reliably receive focus on tap in
// iOS Safari (only real form controls like <input>/<select> do), so the
// existing group-hover/group-focus-within CSS never fires from a touch tap -
// this adds a third, independent way in via a real click handler, alongside
// (not replacing) the CSS-only hover/focus paths InfoTooltip/LvrBadge already
// have. `ref` goes on the outer wrapper so the outside-click listener can
// tell a tap on the trigger itself (already handled by `toggle`) apart from
// a tap anywhere else on the page (which should close it).
export function useTooltipToggle() {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeIfOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('click', closeIfOutside);
    return () => document.removeEventListener('click', closeIfOutside);
  }, [isOpen]);

  return { isOpen, toggle: () => setIsOpen((v) => !v), ref };
}
