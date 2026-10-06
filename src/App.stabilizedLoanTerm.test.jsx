// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { seedScenario } from './test/healthCheckScenarios';

// TODO-183: schedule sliders run to month 360 whatever the loan term, so the
// Stabilized month could land after the loan was already paid off. Re-amortizing
// over `totalMonths - month + 1` then gave zero or negative months and an
// Infinity/NaN/negative payment feeding the Stabilized Stress Test.
// (A 'no Infinity/NaN on the page' check was tried and passes even without the
// cap, so only the month itself is asserted.)
// The re-amortization only runs when a rate change is active by that month, so
// the scenario schedules one inside the term (month 100) and an income ending
// at month 120, which put the reading at 121 -> zero remaining months.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  localStorage.clear();
});

const row = (label) => screen.getByText(label).closest('div').parentElement;

describe('Stabilized month past the loan term (TODO-183)', () => {
  // 10-year loan (120 months): a rate rise at month 100, and an income that
  // stops at month 120 (so the uncapped reading lands at month 121).
  const scenario = {
    loanTermYears: 10,
    salaryGrowthRate: 0, rentGrowthRate: 0, expenseGrowthRate: 0,
    interestRateChanges: [{ id: 1, amount: 8, startMonth: 100 }],
    incomeSources: [
      { id: 1, name: 'Salary/Wages', amount: 3000, startMonth: 1, recurrence: 'monthly', endMonth: 360 },
      { id: 2, name: 'Salary/Wages', amount: 500, startMonth: 1, recurrence: 'monthly', endMonth: 120 },
    ],
  };

  async function renderShortTerm() {
    seedScenario(scenario);
    vi.resetModules();
    const { default: FreshApp } = await import('./App');
    return render(<FreshApp />);
  }

  it('settles no later than the last month of the loan', async () => {
    await renderShortTerm();
    const tooltip = row('Housing Cost Ratio').querySelector('[role="tooltip"]');
    expect(tooltip.textContent).toMatch(/reflects month 120 /);
  });
});
