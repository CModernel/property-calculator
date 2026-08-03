// Turns the raw text of a number input into a number, or null when the text is
// empty, partial or not a finite number.
//
// Returning null rather than NaN is what lets a controlled field be cleared and
// retyped: `Number('')` is 0, so a bare `Number(e.target.value)` snaps the box to
// 0 the moment the user clears it, and they can never type a fresh value.
export function parseNumberInput(raw) {
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;

  return parsed;
}
