// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { SALARY, seedScenario } from './test/healthCheckScenarios';

// TODO-182: the point-in-time figures read one exact month - month 1 for Day 1,
// the Stabilized month for the other reading - so a quarterly/yearly item that
// starts in month 1 counted IN FULL on Day 1 and not at all at month 60 (a
// month it doesn't fire in). With nothing else changing, that alone produced a
// "stabilizes to" arrow claiming things get better. Both readings now count its
// monthly average, so a flat scenario reads flat.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  localStorage.clear();
});

const row = (label) => screen.getByText(label).closest('div').parentElement;

describe('quarterly and yearly items at their monthly average (TODO-182)', () => {
  const scenario = {
    salaryGrowthRate: 0, rentGrowthRate: 0, expenseGrowthRate: 0,
    incomeSources: [SALARY, { ...SALARY, id: 2, amount: 900, recurrence: 'quarterly' }],
    personalExpenseItems: [{ id: 1, name: 'Insurance', amount: 1200, startMonth: 1, recurrence: 'yearly', endMonth: 360 }],
  };

  async function renderScenario() {
    seedScenario(scenario);
    vi.resetModules();
    const { default: FreshApp } = await import('./App');
    return render(<FreshApp />);
  }

  it('shows a yearly $1,200 expense as $100 a month on Day 1', async () => {
    await renderScenario();
    expect(screen.getByRole('button', { name: /Personal expenses breakdown \(subtotal: \$100\/month\)/ })).toBeInTheDocument();
  });

  // The Total Summary's expandable list must add up to its own header.
  it('lists the item at the same $100 its subtotal shows', async () => {
    await renderScenario();
    fireEvent.click(screen.getByRole('button', { name: /Personal Expenses:/ }));
    const line = screen.getByText('Insurance:').parentElement;
    expect(line.textContent).toBe('Insurance:-$100');
  });

  it('reads a flat scenario as flat, not as improving', async () => {
    await renderScenario();
    // Emergency Buffer moves with the yearly expense, Housing Cost Ratio with
    // the quarterly income - one of each recurrence.
    expect(within(row('Emergency Buffer')).getByText(/stabilizes to/).textContent).toMatch(/^→/);
    expect(within(row('Housing Cost Ratio')).getByText(/stabilizes to/).textContent).toMatch(/^→/);
  });
});
