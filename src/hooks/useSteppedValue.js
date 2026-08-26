import { useState } from 'react';

// A value that stays at `base` until one or more scheduled changes kick in,
// each superseding the previous one from its startMonth onward (see
// getSteppedValue in src/calculations/steppedValue.js for how a month's
// effective value is resolved).
export function useSteppedValue(initialBase, initialChanges = []) {
  const [base, setBase] = useState(initialBase);
  const [changes, setChanges] = useState(initialChanges);

  // min/max are the owning field's own bounds (e.g. INTEREST_RATE_FIELD's
  // 0.1-20), passed in by the caller rather than hardcoded here - see
  // TODO-169: an unvalidated scheduled rate change of 0% or less NaNs or
  // silently corrupts the whole simulation, a hazard the base slider already
  // guards against via its own min but this path did not.
  const addChange = (amount, startMonth, min, max) => {
    if (changes.some((c) => c.startMonth === startMonth)) {
      alert('A change already exists for this month. Remove it first or choose a different month.');
      return;
    }
    const outOfRange = !Number.isFinite(amount) || (min !== undefined && amount < min) || (max !== undefined && amount > max);
    if (outOfRange) {
      const bounds = min !== undefined && max !== undefined ? ` Enter a value between ${min} and ${max}.` : ' Enter a valid amount.';
      alert(`That amount isn't valid.${bounds}`);
      return;
    }
    setChanges([...changes, { id: Date.now(), amount, startMonth }]);
  };

  const removeChange = (id) => {
    setChanges(changes.filter((c) => c.id !== id));
  };

  return { base, setBase, changes, addChange, removeChange };
}
