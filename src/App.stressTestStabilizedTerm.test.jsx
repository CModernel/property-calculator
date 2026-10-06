// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SALARY, seedScenario } from './test/healthCheckScenarios';

// The Stabilized Interest Rate Stress Test re-amortizes at rate+1/2/3 and
// compares the result against projectedTotalPropertyCost, which is built from
// projected.monthlyPayment. Those two payments must be amortized over the SAME
// principal and term. They weren't: the baseline used the remaining term
// (projectedHealthCheck.js's `totalMonths - month + 1`) while the stress test
// was handed the full `totalMonths`. A longer term makes an installment
// CHEAPER, so a big enough term gap outweighed a full 3-point rate rise and the
// panel reported "Survives +3%" for a month the app had already computed as
// being in deficit at the unstressed rate - the value and the deficit flag on
// the same row asserting opposite things.
//
// Scenario below: $800k at 6% over 30 years, a scheduled rise to 10% at month
// 240, one salary of $1,550/wk. TODO-184 re-amortizes the balance still owed
// (~$435k), not the original loan, over the 121 months left: ~$5.7k/mo, more than this income covers. Stressed over the full 360
// months instead, even 13% on that balance is cheaper, which is the wrong
// "Survives +3%". (The pre-TODO-184 version of this test used 8% at month 300,
// which only went into deficit because the original $800k was being spread
// over the last 61 months.)

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  localStorage.clear();
});

function stressTestRow() {
  return screen.getByText('Interest Rate Stress Test').closest('div').parentElement;
}

describe('Stabilized Interest Rate Stress Test amortization term', () => {
  it('reports "Already in deficit" rather than surviving a rate rise it cannot survive', async () => {
    seedScenario({
      salaryGrowthRate: 0, rentGrowthRate: 0, expenseGrowthRate: 0,
      downPayment: 50000, interestRate: 6,
      interestRateChanges: [{ id: 1, amount: 10, startMonth: 240 }],
      incomeSources: [{ ...SALARY, amount: 1550 }],
    });
    vi.resetModules();
    const { default: App } = await import('./App');
    render(<App />);
    const row = stressTestRow();

    // The Stabilized month really is the scheduled change, not the year-5
    // fallback - otherwise this scenario proves nothing.
    expect(within(row).getByText(/reflects month 240/)).toBeInTheDocument();

    const stabilized = within(row).getByText(/stabilizes to/).textContent;
    expect(stabilized).toContain('Already in deficit');
    // The specific wrong reading the full-term amortization produced.
    expect(stabilized).not.toMatch(/Survives \+\d%/);
  });
});
