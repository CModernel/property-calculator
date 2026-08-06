const STORAGE_KEY = 'propertyCalculator.scenario';
// Bumped to 2 in TODO-26: fortnightlyIncome (a single scalar) was replaced by
// incomeSources (a list) - old saved scenarios are cleanly discarded rather
// than merged into the new shape.
// Bumped to 3 in TODO-31: incomeSources/exceptExpenses entries switched from
// {type, month, recurrence: 'forever'|'period', startMonth, endMonth} to a
// unified {startMonth, recurrence: 'none'|'monthly'|'quarterly'|'yearly',
// endMonth} Schedule shape.
// Bumped to 4 in TODO-33: tenants dropped {type: 'single'|'shared'} in favor
// of {isShared, numPeople, amountPerPerson} - amount is now computed
// (amountPerPerson * numPeople) instead of a flat entered total.
// Bumped to 5 in TODO-29: the separate `tenants` array was merged into
// incomeSources (each tenant is now an incomeSources entry carrying
// isShared/numPeople/amountPerPerson) - a saved scenario's top-level
// `tenants` field no longer exists.
// Bumped to 6 in TODO-32: offsetContributions entries switched from
// {id, month, amount} to the same Schedule shape as incomeSources/
// exceptExpenses ({id, amount, startMonth, recurrence, endMonth}), so a
// contribution can now recur instead of always being a single lump sum.
// Bumped to 7 in TODO-36: the flat `otherExpenses`/`otherExpensesChanges`
// SteppedExpenseField was retired in favor of `otherExpenseItems`, a
// Schedule-shaped list (Health/Subscriptions/Entertainment/Debt Repayment/
// Custom) - unlike TODO-35's purely-additive change, this genuinely drops a
// field that could hold real user data, so old scenarios are discarded
// cleanly rather than silently losing that expense on load.
// Bumped to 8 in TODO-66: the flat `foodExpenses`/`transportExpenses`/
// `phoneInternet` SteppedExpenseFields (and the separately-labeled
// `exceptExpenses` list) were retired in favor of a single
// `personalExpenseItems` Schedule-shaped list, same shape as
// `otherExpenseItems` - same "genuinely drops fields that could hold real
// user data" reasoning as TODO-36's bump above.
// Bumped to 9 in TODO-85: `otherExpenseItems` was retired - its categories
// (Health/Subscriptions/Entertainment/Debt Repayment/Custom) are now just
// more entries in `personalExpenseItems`, added via the same category
// picklist. Same discard-not-migrate reasoning as every bump above: a
// saved `otherExpenseItems` array could hold real user data that can't be
// safely folded into the merged list automatically.
const SCHEMA_VERSION = 9;

// A version mismatch means the saved shape no longer matches what this
// version of the app expects - discard rather than attempt a migration,
// since a half-migrated state is worse than starting from defaults.
export function parseScenarioPayload(raw, expectedVersion = SCHEMA_VERSION) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== expectedVersion) return null;
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

export function serializeScenarioPayload(data, version = SCHEMA_VERSION) {
  return JSON.stringify({ version, data });
}

// Thin, unavoidably-impure wrappers over localStorage - not unit tested
// (same convention as NumberSliderField/hooks: browser-API-touching code is
// verified manually, not under vitest's 'node' test environment).
export function loadScenario() {
  try {
    return parseScenarioPayload(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveScenario(data) {
  try {
    localStorage.setItem(STORAGE_KEY, serializeScenarioPayload(data));
    return true;
  } catch {
    return false;
  }
}

export function clearScenario() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort
  }
}
