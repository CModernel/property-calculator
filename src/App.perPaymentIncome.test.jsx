// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SALARY, seedScenario } from './test/healthCheckScenarios';

// TODO-185: a non-monthly income amount is dollars per payment. A yearly
// $1,200 dividend used to be read as $1,200 a WEEK - $5,200 a year in the
// simulation and ~$433/month on the cards.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  localStorage.clear();
});

const DIVIDEND = { id: 2, name: 'Dividends', amount: 1200, startMonth: 1, recurrence: 'yearly', endMonth: 360 };

async function renderWith(incomeSources) {
  seedScenario({ salaryGrowthRate: 0, rentGrowthRate: 0, expenseGrowthRate: 0, incomeSources });
  vi.resetModules();
  const { default: FreshApp } = await import('./App');
  return render(<FreshApp />);
}

const personalIncome = () => {
  const label = screen.getByText('Total Personal Income:');
  return Number(label.nextElementSibling.textContent.replace(/[^0-9.]/g, ''));
};

describe('per-payment income (TODO-185)', () => {
  it('adds a yearly $1,200 dividend as $100 a month on Day 1', async () => {
    const { unmount } = await renderWith([SALARY]);
    const salaryOnly = personalIncome();
    unmount();
    await renderWith([SALARY, DIVIDEND]);
    expect(personalIncome() - salaryOnly).toBe(100);
  });

  it('labels the row per year, not per week', async () => {
    await renderWith([SALARY, DIVIDEND]);
    fireEvent.click(screen.getByRole('button', { name: /Income breakdown/ }));
    expect(screen.getByText('Dividends').nextElementSibling.textContent).toMatch(/^\$1,200 per year/);
  });
});

// The v10 -> v11 migration multiplies by 52/12, which rarely lands on a whole
// dollar - the row shows it rounded, not as $1083.3333333333333.
describe('a migrated per-payment amount (TODO-185)', () => {
  it('is shown rounded on the row', async () => {
    await renderWith([SALARY, { ...DIVIDEND, recurrence: 'quarterly', amount: 250 * 52 / 12 }]);
    fireEvent.click(screen.getByRole('button', { name: /Income breakdown/ }));
    expect(screen.getByText('Dividends').nextElementSibling.textContent).toMatch(/^\$1,083 per quarter/);
  });
});
