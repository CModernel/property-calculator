// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { calculateCompoundedValue } from './calculations/growthRate';
import { calculateMonthlyFromWeekly } from './calculations/loan';
import { calculateVacancyFactor } from './calculations/vacancyFactor';

// TODO-152: the Timeline Explorer's Income Context column is explicitly headed
// "at Month {timelineMonth}", so - unlike the Day-1 Health Check figures
// (TODO-150), where "today, before growth" is a defensible meaning - there is
// no reading under which this panel omitting growth is correct. It now uses
// the same salary/rental/other three-way split offsetSimulation.js applies
// internally, with each group's own growth rate.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

async function addHouseRent(user, weeklyAmount) {
  await user.click(screen.getByRole('button', { name: /Income breakdown/ }));
  await user.click(screen.getByRole('button', { name: '+ Add' }));
  await user.selectOptions(screen.getByDisplayValue('Salary/Wages'), 'House Rent');
  fireEvent.change(screen.getByLabelText('Weekly Rent'), { target: { value: String(weeklyAmount) } });
  fireEvent.blur(screen.getByLabelText('Weekly Rent'));
  await user.click(screen.getByRole('button', { name: 'Add Income' }));
}

function setGrowthRate(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } });
  fireEvent.blur(screen.getByLabelText(label));
}

function goToMonth(month) {
  const monthSlider = screen.getByLabelText('Viewing month');
  fireEvent.change(monthSlider, { target: { value: String(month) } });
}

function incomeContextValue(rowLabel) {
  const row = screen.getByText(rowLabel).closest('p');
  return within(row).getByText(/\/mo$/).textContent;
}

describe('Timeline Explorer Income Context growth (TODO-152)', () => {
  it('applies salary and rent growth at a high timeline month, matching the simulation\'s own formula', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addHouseRent(user, 600);
    await user.click(screen.getByRole('button', { name: /Projection assumptions/ }));
    setGrowthRate('Salary Growth Rate', 3);
    setGrowthRate('Rent Growth Rate', 5);
    setGrowthRate('Vacancy (weeks/year)', 2);

    goToMonth(60);

    // Same formula offsetSimulation.js applies internally: salary grows at
    // salaryGrowthRate, rent grows at rentGrowthRate and is vacancy-adjusted -
    // config.default.json's Salary/Wages is $1,614/wk.
    const expectedPersonal = calculateMonthlyFromWeekly(calculateCompoundedValue(1614, 3, 60));
    const expectedRental = calculateMonthlyFromWeekly(calculateCompoundedValue(600, 5, 60) * calculateVacancyFactor(2));

    expect(incomeContextValue('Personal Income:')).toBe(`$${Math.round(expectedPersonal).toLocaleString()}/mo`);
    expect(incomeContextValue('Rental Income:')).toBe(`$${Math.round(expectedRental).toLocaleString()}/mo`);
  });

  it('leaves both figures unchanged from today\'s behavior when every growth rate is 0', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addHouseRent(user, 600);
    await user.click(screen.getByRole('button', { name: /Projection assumptions/ }));
    setGrowthRate('Salary Growth Rate', 0);
    setGrowthRate('Rent Growth Rate', 0);
    setGrowthRate('Vacancy (weeks/year)', 0);

    goToMonth(60);

    expect(incomeContextValue('Personal Income:')).toBe(`$${Math.round(calculateMonthlyFromWeekly(1614)).toLocaleString()}/mo`);
    expect(incomeContextValue('Rental Income:')).toBe(`$${Math.round(calculateMonthlyFromWeekly(600)).toLocaleString()}/mo`);
  });
});
