import { describe, it, expect } from 'vitest';
import { hasUsableProjection } from './usableProjection';
import { calculateLoanWithOffset } from './offsetSimulation';

// TODO-167: the shared predicate every consumer of a calculateLoanWithOffset
// result branches on, instead of guessing at the sentinel's magic numbers.

describe('hasUsableProjection', () => {
  it('is true for a projection that ran the real loop and produced months', () => {
    expect(hasUsableProjection({ hasUsableProjection: true, monthlyData: [{ month: 1 }] })).toBe(true);
  });

  it('is false for the sentinel early-out', () => {
    expect(hasUsableProjection({ hasUsableProjection: false, monthlyData: [] })).toBe(false);
  });

  // Neither condition implies the other, which is why both are checked. A
  // maxMonths: 0 run has real figures (the loop ran, it just had no months to
  // run through) but no series for getTimelineSnapshot to read - pinned in
  // offsetSimulation.test.js's 'sentinel early-out boundary conditions'.
  it('is false for a real projection that produced no months at all', () => {
    expect(hasUsableProjection({ hasUsableProjection: true, monthlyData: [] })).toBe(false);
  });

  it('is false for a result missing the flag entirely, rather than defaulting to usable', () => {
    expect(hasUsableProjection({ monthlyData: [{ month: 1 }] })).toBe(false);
  });

  describe('against the real engine, not a hand-built fixture', () => {
    const BASE = {
      contributions: [],
      personalExpenseItems: [],
      loanAmount: 100000,
      monthlyRate: 0.005,
      monthlyPayment: 500,
    };

    it('rejects the engine\'s own early-out result', () => {
      expect(hasUsableProjection(calculateLoanWithOffset({ ...BASE, monthlyToOffset: 0 }))).toBe(false);
    });

    it('accepts the engine\'s own normal result', () => {
      expect(hasUsableProjection(calculateLoanWithOffset({ ...BASE, monthlyToOffset: 1000 }))).toBe(true);
    });

    it('rejects a maxMonths: 0 run even though its figures are real', () => {
      const result = calculateLoanWithOffset({ ...BASE, monthlyToOffset: 1000, maxMonths: 0 });
      expect(result.hasUsableProjection).toBe(true);
      expect(result.monthlyData).toEqual([]);
      expect(hasUsableProjection(result)).toBe(false);
    });
  });
});
