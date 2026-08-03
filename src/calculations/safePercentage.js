// `part` as a percentage of `whole`, without producing NaN or Infinity.
//
// A zero `whole` is a legitimate state here — a 100% cash purchase means
// loanAmount is 0 — so callers pick what that should read as: 0 for "none of it"
// (an LVR with no loan) or 100 for "all of it" (a progress bar with nothing left
// owing).
export function safePercentage(part, whole, fallback = 0) {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole === 0) return fallback;
  return (part / whole) * 100;
}
