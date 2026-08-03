import { useState } from 'react';

// A value that stays at `base` until one or more scheduled changes kick in,
// each superseding the previous one from its startMonth onward (see
// getSteppedValue in src/calculations/steppedValue.js for how a month's
// effective value is resolved).
export function useSteppedValue(initialBase) {
  const [base, setBase] = useState(initialBase);
  const [changes, setChanges] = useState([]);

  const addChange = (amount, startMonth) => {
    if (changes.some((c) => c.startMonth === startMonth)) {
      alert('A change already exists for this month. Remove it first or choose a different month.');
      return;
    }
    setChanges([...changes, { id: Date.now(), amount, startMonth }]);
  };

  const removeChange = (id) => {
    setChanges(changes.filter((c) => c.id !== id));
  };

  return { base, setBase, changes, addChange, removeChange };
}
