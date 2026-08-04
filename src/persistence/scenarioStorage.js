const STORAGE_KEY = 'propertyCalculator.scenario';
// Bumped to 2 in TODO-26: fortnightlyIncome (a single scalar) was replaced by
// incomeSources (a list) - old saved scenarios are cleanly discarded rather
// than merged into the new shape.
const SCHEMA_VERSION = 2;

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
