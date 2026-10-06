// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SALARY, seedScenario } from './test/healthCheckScenarios';

// TODO-181: the Stabilized reading is "after everything scheduled has
// happened", but an item that ENDS was still counted in its own end month
// (endMonth is inclusive), which is where the reading was taken - so a job or
// tenant that stops at month N never showed up as stopped.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  localStorage.clear();
});

const row = (label) => screen.getByText(label).closest('div').parentElement;

describe('Stabilized reading after a recurring income ends (TODO-181)', () => {
  // A second salary of $800/wk that stops after month 24, no growth anywhere so
  // the only thing that moves between the readings is that income going away.
  const ENDING_INCOME = { id: 2, name: 'Salary/Wages', amount: 800, startMonth: 1, recurrence: 'monthly', endMonth: 24 };
  const scenario = {
    salaryGrowthRate: 0, rentGrowthRate: 0, expenseGrowthRate: 0,
    incomeSources: [SALARY, ENDING_INCOME],
  };

  async function renderEnding() {
    seedScenario(scenario);
    vi.resetModules();
    const { default: FreshApp } = await import('./App');
    return render(<FreshApp />);
  }

  it('reads the Housing Cost Ratio from the first month the income is gone', async () => {
    await renderEnding();
    const note = within(row('Housing Cost Ratio')).getByText(/stabilizes to/).textContent;

    // 44% is what the salary alone costs against this loan; Day 1 is lower
    // because the second income is still coming in. The old reading (taken IN
    // month 24) kept it and said "stabilizes to" the Day-1 figure.
    expect(note).toMatch(/^↘ stabilizes to 44%/);
    expect(row('Housing Cost Ratio').querySelector('span.font-semibold').textContent).toMatch(/^🟠 29%/);
  });

  it('names month 25 - the first month without it - as the Stabilized month', async () => {
    await renderEnding();
    const tooltip = row('Housing Cost Ratio').querySelector('[role="tooltip"]');
    expect(tooltip.textContent).toMatch(/reflects month 25 /);
  });
});
