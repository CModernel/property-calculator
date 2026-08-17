import { describe, it, expect } from 'vitest';
import { summariseAffordability } from './affordabilitySummary';

const GREEN = { label: 'Good', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false };
const ORANGE = { label: 'Moderate', symbol: '🟠', textClass: 'text-orange-600 dark:text-orange-400', critical: false };
const RED_CRITICAL = { label: 'High risk', symbol: '🔴', textClass: 'text-red-600 dark:text-red-400', critical: true };

const healthy = {
  cashRemaining: 28000,
  monthlyNetBalance: 2400,
  emergencyBufferClass: GREEN,
  housingCostRatioClass: GREEN,
};

describe('summariseAffordability', () => {
  it('reports Funded when both hard constraints clear and both indicators are green', () => {
    const result = summariseAffordability(healthy);
    expect(result.label).toBe('Funded');
    expect(result.symbol).toBe('🟢');
    expect(result.bindingConstraint).toBeNull();
  });

  it('a negative cashRemaining is the binding constraint', () => {
    const result = summariseAffordability({ ...healthy, cashRemaining: -9937 });
    expect(result.label).toBe('Settlement not covered');
    expect(result.bindingConstraint).toBe('cashRemaining');
  });

  it('a monthly shortfall is the binding constraint', () => {
    const result = summariseAffordability({ ...healthy, monthlyNetBalance: -1057 });
    expect(result.label).toBe('Monthly shortfall');
    expect(result.bindingConstraint).toBe('monthlyNetBalance');
  });

  // The whole point of the hardest-first ordering: a comfortable monthly
  // surplus does not make an unsettleable purchase affordable.
  it('an unsettleable purchase outranks a healthy monthly surplus', () => {
    const result = summariseAffordability({ ...healthy, cashRemaining: -1, monthlyNetBalance: 9000 });
    expect(result.bindingConstraint).toBe('cashRemaining');
  });

  // ...and a monthly shortfall outranks green indicators.
  it('a monthly shortfall outranks green Health Check indicators', () => {
    const result = summariseAffordability({
      ...healthy, monthlyNetBalance: -1, emergencyBufferClass: GREEN, housingCostRatioClass: GREEN,
    });
    expect(result.bindingConstraint).toBe('monthlyNetBalance');
  });

  it('surfaces the worse of the two indicators when neither hard constraint binds', () => {
    const result = summariseAffordability({ ...healthy, housingCostRatioClass: ORANGE });
    expect(result.label).toBe('Tight but funded');
    expect(result.symbol).toBe('🟠');
    expect(result.bindingConstraint).toBe('housingCostRatio');
  });

  it('a critical indicator outranks a merely-moderate one regardless of symbol order', () => {
    const result = summariseAffordability({
      ...healthy, emergencyBufferClass: RED_CRITICAL, housingCostRatioClass: ORANGE,
    });
    expect(result.bindingConstraint).toBe('emergencyBuffer');
    expect(result.symbol).toBe('🔴');
  });

  it('borrows the worse indicator\'s own textClass rather than inventing a colour', () => {
    const result = summariseAffordability({ ...healthy, emergencyBufferClass: ORANGE });
    expect(result.textClass).toBe(ORANGE.textClass);
  });

  it('tolerates a missing indicator classification', () => {
    const result = summariseAffordability({ ...healthy, housingCostRatioClass: null });
    expect(result.label).toBe('Funded');
  });

  // cashRemaining of exactly 0 means the purchase settles with nothing spare -
  // funded, not a shortfall.
  it('treats exactly-zero cashRemaining as covered, not a shortfall', () => {
    const result = summariseAffordability({ ...healthy, cashRemaining: 0 });
    expect(result.label).toBe('Funded');
  });
});
