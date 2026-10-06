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
// Bumped to 10 in TODO-136: `offsetAllocationPct` was retired - the monthly
// surplus no longer splits between the offset and a separate savings
// balance, it splits directly between the offset and ETF investing via
// `etfAllocationPct`. Same discard-not-migrate reasoning: a saved
// offsetAllocationPct below 100 described a strategy this app can no longer
// express, and silently reinterpreting it would change the user's projection
// without telling them.
// Bumped to 11 in TODO-185: quarterly, yearly and one-time income amounts are
// now dollars PER PAYMENT instead of dollars per week (monthly income stays
// per week). Unlike every bump above, this one MIGRATES instead of
// discarding: the shape didn't change, only what one number means, and the
// conversion is exact - multiplying those amounts by 52/12 reproduces the
// money the old reading already deposited, so no saved projection moves. The
// row simply starts showing the per-payment figure the simulation was using.
const SCHEMA_VERSION = 11;

const PER_WEEK_TO_PER_MONTH = 52 / 12;

export function migrateV10toV11(data) {
  if (!Array.isArray(data.incomeSources)) return data;
  return {
    ...data,
    incomeSources: data.incomeSources.map((item) => {
      if (item.recurrence === 'monthly') return item;
      const migrated = { ...item, amount: item.amount * PER_WEEK_TO_PER_MONTH };
      if (item.amountPerPerson != null) migrated.amountPerPerson = item.amountPerPerson * PER_WEEK_TO_PER_MONTH;
      return migrated;
    }),
  };
}

// Keyed by the version a migration upgrades FROM. Only exact, lossless
// reinterpretations belong here; a change that drops or reshapes user data
// still bumps without an entry, and that version keeps being discarded.
const MIGRATIONS = { 10: migrateV10toV11 };

// A version mismatch means the saved shape no longer matches what this
// version of the app expects - discard rather than attempt a migration,
// since a half-migrated state is worse than starting from defaults. The one
// exception is an unbroken chain of MIGRATIONS up to the expected version.
export function parseScenarioPayload(raw, expectedVersion = SCHEMA_VERSION) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    let data = parsed?.data ?? null;
    if (data === null) return null;
    let version = parsed.version;
    while (version !== expectedVersion) {
      const migrate = typeof version === 'number' && version < expectedVersion ? MIGRATIONS[version] : undefined;
      if (!migrate) return null;
      data = migrate(data);
      version += 1;
    }
    return data;
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
