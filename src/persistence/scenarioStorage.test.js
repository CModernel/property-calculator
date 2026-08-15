import { describe, it, expect } from 'vitest';
import { parseScenarioPayload, serializeScenarioPayload } from './scenarioStorage';

describe('parseScenarioPayload', () => {
  it('returns null for null input', () => {
    expect(parseScenarioPayload(null)).toBeNull();
  });

  it('returns null for empty string input', () => {
    expect(parseScenarioPayload('')).toBeNull();
  });

  // Uses the injectable expectedVersion rather than hardcoding the current
  // SCHEMA_VERSION, so these stay meaningful across bumps. The literal used
  // to be 9; TODO-136's bump to 10 made it fail, and the "data is missing"
  // case below would have started passing for the wrong reason (version
  // mismatch, not the missing key it claims to test).
  it('returns the data when the version matches', () => {
    const raw = JSON.stringify({ version: 42, data: { propertyPrice: 900000 } });
    expect(parseScenarioPayload(raw, 42)).toEqual({ propertyPrice: 900000 });
  });

  it('returns null when the version does not match', () => {
    const raw = JSON.stringify({ version: 999, data: { propertyPrice: 900000 } });
    expect(parseScenarioPayload(raw)).toBeNull();
  });

  it('returns null for corrupted JSON without throwing', () => {
    expect(() => parseScenarioPayload('{not valid json')).not.toThrow();
    expect(parseScenarioPayload('{not valid json')).toBeNull();
  });

  it('returns null when data is missing', () => {
    const raw = JSON.stringify({ version: 42 });
    expect(parseScenarioPayload(raw, 42)).toBeNull();
  });
});

describe('serializeScenarioPayload / parseScenarioPayload roundtrip', () => {
  it('recovers the original data after a serialize -> parse roundtrip', () => {
    const data = { propertyPrice: 850000, tenants: [{ id: 1, weeklyRent: 600 }] };
    const raw = serializeScenarioPayload(data);
    expect(parseScenarioPayload(raw)).toEqual(data);
  });
});
