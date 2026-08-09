import { describe, it, expect } from 'vitest';
import { runStrategyGrid, selectParetoFront, calculateEtfCrashSurvivedPct, classifyEtfCrash, ETF_CRASH_BANDS } from './strategyComparison';

const BASE_PARAMS = {
  contributions: [],
  personalExpenseItems: [],
  monthlyToOffset: 1000,
  loanAmount: 500_000,
  monthlyRate: 0.005,
  monthlyPayment: 3000,
  offsetAllocationPct: 100,
  expectedEtfReturn: 8,
  effectiveTaxRate: 30,
  maxMonths: 24,
};

describe('runStrategyGrid', () => {
  it('runs the full 21x21 (5% step) grid', () => {
    const results = runStrategyGrid(BASE_PARAMS);
    expect(results).toHaveLength(441);
  });

  it('each row carries the grid coordinates plus the computed outcome fields', () => {
    const results = runStrategyGrid(BASE_PARAMS);
    for (const row of results) {
      expect(row).toMatchObject({
        switchThresholdPct: expect.any(Number),
        etfAllocationPct: expect.any(Number),
        totalInterestPaid: expect.any(Number),
        etfBalance: expect.any(Number),
        offsetBalance: expect.any(Number),
        riskScore: expect.any(Number),
      });
      expect(row.riskScore).toBeGreaterThanOrEqual(0);
      expect(row.riskScore).toBeLessThanOrEqual(100);
    }
  });

  it('the etfAllocationPct: 0 cells all produce the same (baseline) outcome regardless of switchThresholdPct', () => {
    const results = runStrategyGrid(BASE_PARAMS);
    const zeroAllocationRows = results.filter((r) => r.etfAllocationPct === 0);
    const [first, ...rest] = zeroAllocationRows;
    for (const row of rest) {
      expect(row.totalInterestPaid).toBe(first.totalInterestPaid);
      expect(row.etfBalance).toBe(first.etfBalance);
      expect(row.etfBalance).toBe(0);
      expect(row.riskScore).toBe(0);
    }
  });
});

describe('selectParetoFront', () => {
  it('returns a non-dominated set, capped at 5 rows', () => {
    const front = selectParetoFront(runStrategyGrid(BASE_PARAMS));
    expect(front.length).toBeGreaterThan(0);
    expect(front.length).toBeLessThanOrEqual(5);
    for (const row of front) {
      const dominatedBy = front.find(
        (other) =>
          other !== row &&
          other.totalInterestPaid <= row.totalInterestPaid &&
          other.etfBalance >= row.etfBalance &&
          (other.totalInterestPaid < row.totalInterestPaid || other.etfBalance > row.etfBalance)
      );
      expect(dominatedBy).toBeUndefined();
    }
  });

  it('always includes the etfAllocationPct: 0 baseline as the lowest-risk anchor', () => {
    const front = selectParetoFront(runStrategyGrid(BASE_PARAMS));
    const lowestRisk = front[0];
    expect(lowestRisk.etfAllocationPct).toBe(0);
    expect(lowestRisk.etfBalance).toBe(0);
  });

  it('is sorted ascending by etfBalance (lowest-risk to highest-risk)', () => {
    const front = selectParetoFront(runStrategyGrid(BASE_PARAMS));
    for (let i = 1; i < front.length; i++) {
      expect(front[i].etfBalance).toBeGreaterThanOrEqual(front[i - 1].etfBalance);
    }
  });

  it('deduplicates identical outcomes down to a small explicit example', () => {
    const results = [
      { switchThresholdPct: 0, etfAllocationPct: 0, totalInterestPaid: 100, etfBalance: 0, offsetBalance: 500, riskScore: 0 },
      { switchThresholdPct: 50, etfAllocationPct: 0, totalInterestPaid: 100, etfBalance: 0, offsetBalance: 500, riskScore: 0 },
      { switchThresholdPct: 0, etfAllocationPct: 50, totalInterestPaid: 150, etfBalance: 200, offsetBalance: 300, riskScore: 40 },
    ];
    const front = selectParetoFront(results);
    expect(front).toHaveLength(2);
    expect(front[0]).toMatchObject({ switchThresholdPct: 0, etfAllocationPct: 0 });
  });
});

describe('calculateEtfCrashSurvivedPct', () => {
  it('trivially survives any crash when there was no extra interest cost to begin with', () => {
    expect(calculateEtfCrashSurvivedPct(0, 0)).toBe(50);
  });

  it('survives a smaller crash but not a larger one once the balance gets close to the extra interest cost', () => {
    // 1000 * (1 - 0.3) = 700 >= 600 -> survives 30%; 1000 * (1 - 0.5) = 500 < 600 -> fails 50%.
    expect(calculateEtfCrashSurvivedPct(1000, 600)).toBe(30);
  });

  it('returns 0 when even a 10% crash would put the strategy behind the baseline', () => {
    expect(calculateEtfCrashSurvivedPct(1000, 950)).toBe(0);
  });

  it('is already behind the baseline before any crash at all', () => {
    expect(calculateEtfCrashSurvivedPct(100, 500)).toBe(0);
  });
});

describe('classifyEtfCrash', () => {
  it('matches the ETF_CRASH_BANDS thresholds', () => {
    expect(classifyEtfCrash(50)).toBe(ETF_CRASH_BANDS[0]);
    expect(classifyEtfCrash(30)).toBe(ETF_CRASH_BANDS[1]);
    expect(classifyEtfCrash(10)).toBe(ETF_CRASH_BANDS[2]);
    expect(classifyEtfCrash(0)).toBe(ETF_CRASH_BANDS[3]);
  });

  it('classifies an intermediate (non-boundary) value into the correct band', () => {
    expect(classifyEtfCrash(40)).toBe(ETF_CRASH_BANDS[1]); // between 30 and 50 -> "Resilient"
    expect(classifyEtfCrash(75)).toBe(ETF_CRASH_BANDS[0]); // > 50 -> "Very resilient"
  });
});

describe('runStrategyGrid - offset-sim sentinel path', () => {
  it('defaults etfBalance/offsetBalance to 0 without throwing when every grid cell hits the sentinel (empty monthlyData)', () => {
    const results = runStrategyGrid({
      contributions: [],
      personalExpenseItems: [],
      monthlyToOffset: 0,
      loanAmount: 100000,
      monthlyRate: 0.005,
      monthlyPayment: 500,
      offsetAllocationPct: 100,
      expectedEtfReturn: 8,
      effectiveTaxRate: 30,
      maxMonths: 24,
    });
    expect(results).toHaveLength(441);
    for (const row of results) {
      expect(row.etfBalance).toBe(0);
      expect(row.offsetBalance).toBe(0);
      expect(row.totalInterestPaid).toBe(999999);
      expect(row.riskScore).toBe(0);
    }
  });
});

describe('selectParetoFront - additional boundary/dominance cases', () => {
  it('returns an empty array when given no results', () => {
    expect(selectParetoFront([])).toEqual([]);
  });

  it('excludes a row that is strictly dominated by another (same etfBalance, worse interest)', () => {
    const results = [
      { switchThresholdPct: 0, etfAllocationPct: 0, totalInterestPaid: 100, etfBalance: 100, offsetBalance: 400, riskScore: 20 },
      { switchThresholdPct: 50, etfAllocationPct: 50, totalInterestPaid: 200, etfBalance: 100, offsetBalance: 300, riskScore: 25 },
    ];
    const front = selectParetoFront(results);
    expect(front).toHaveLength(1);
    expect(front[0].totalInterestPaid).toBe(100);
  });

  it('returns all 5 points unchanged (no sampling) when there are exactly 5 distinct pareto points', () => {
    const results = Array.from({ length: 5 }, (_, i) => ({
      switchThresholdPct: 0,
      etfAllocationPct: i * 25,
      totalInterestPaid: 100 + i * 10,
      etfBalance: i * 25,
      offsetBalance: 500 - i * 25,
      riskScore: i * 25,
    }));
    const front = selectParetoFront(results);
    expect(front).toHaveLength(5);
    expect(front.map(r => r.etfBalance)).toEqual([0, 25, 50, 75, 100]);
  });

  it('returns exactly 5 evenly-spaced points, at the specific sampled indices, when there are 6 distinct pareto points', () => {
    const results = Array.from({ length: 6 }, (_, i) => ({
      switchThresholdPct: 0,
      etfAllocationPct: i * 20,
      totalInterestPaid: 100 + i * 10,
      etfBalance: i * 20,
      offsetBalance: 500 - i * 20,
      riskScore: i * 20,
    }));
    const front = selectParetoFront(results);
    expect(front).toHaveLength(5);
    // Indices 0,1,3,4,5 (Math.round(i*5/4) for i=0..4) - index 2 (etf:40) is
    // the one point dropped by the evenly-spaced sampling.
    expect(front.map(r => r.etfBalance)).toEqual([0, 20, 60, 80, 100]);
  });
});

describe('calculateEtfCrashSurvivedPct - additional boundary cases', () => {
  it('treats an exact equality at a crash-tier boundary as surviving (uses >=, not >)', () => {
    // 1000 * (1 - 0.5) = 500 === 500 -> survives the 50% tier exactly at the boundary.
    expect(calculateEtfCrashSurvivedPct(1000, 500)).toBe(50);
  });

  it('returns 0 for every crash tier when etfBalance is 0 but there was a real extra interest cost', () => {
    expect(calculateEtfCrashSurvivedPct(0, 100)).toBe(0);
  });
});
