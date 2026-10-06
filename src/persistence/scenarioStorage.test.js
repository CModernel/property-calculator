import { describe, it, expect } from 'vitest';
import { parseScenarioPayload, serializeScenarioPayload, migrateV10toV11 } from './scenarioStorage';

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

// TODO-185: the first migration this store has. Version 10 read every income
// amount as dollars per week; from 11, quarterly/yearly/one-time income is
// dollars per payment. Multiplying those amounts by 52/12 on load keeps every
// saved projection exactly as it was - only the number on the row changes, to
// the per-payment figure the simulation was already using.
describe('the v10 -> v11 migration (TODO-185)', () => {
  const v10 = {
    propertyPrice: 850000,
    incomeSources: [
      { id: 1, name: 'Salary/Wages', amount: 1614, startMonth: 1, recurrence: 'monthly', endMonth: 360 },
      { id: 2, name: 'Dividends', amount: 300, startMonth: 1, recurrence: 'quarterly', endMonth: 360 },
      { id: 3, name: 'Bonus', amount: 1200, startMonth: 6, recurrence: 'none' },
      { id: 4, name: 'Room Rent', amount: 600, amountPerPerson: 300, numPeople: 2, isShared: true, startMonth: 1, recurrence: 'yearly', endMonth: 360 },
    ],
  };

  it('converts per-week amounts on non-monthly income to per-payment, keeping the money', () => {
    const migrated = parseScenarioPayload(serializeScenarioPayload(v10, 10));
    const [salary, dividends, bonus, room] = migrated.incomeSources;
    expect(salary).toEqual(v10.incomeSources[0]);
    expect(dividends.amount).toBeCloseTo(1300, 10);
    expect(bonus.amount).toBeCloseTo(5200, 10);
    expect(room.amount).toBeCloseTo(2600, 10);
    expect(room.amountPerPerson).toBeCloseTo(1300, 10);
    expect(migrated.propertyPrice).toBe(850000);
  });

  it('copes with a scenario that has no income list', () => {
    expect(migrateV10toV11({ propertyPrice: 1 })).toEqual({ propertyPrice: 1 });
  });

  it('still discards a version with no migration path', () => {
    expect(parseScenarioPayload(serializeScenarioPayload(v10, 9))).toBeNull();
  });

  it('does not migrate a payload that is already current', () => {
    const current = parseScenarioPayload(serializeScenarioPayload(v10));
    expect(current.incomeSources[1].amount).toBe(300);
  });
});
