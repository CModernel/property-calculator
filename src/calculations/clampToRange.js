// Keeps a value inside [min, max]. Either bound may be undefined, meaning
// unbounded on that side.
export function clampToRange(value, min, max) {
  if (!Number.isFinite(value)) return Number.isFinite(min) ? min : 0;
  if (Number.isFinite(min) && value < min) return min;
  if (Number.isFinite(max) && value > max) return max;
  return value;
}
