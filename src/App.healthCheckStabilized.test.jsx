// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// TODO-134: Purchase Health Check's Emergency Buffer/Housing Cost Ratio/
// Interest Rate Stress Test/Gearing/Vacancy Buffer/Rental Yield indicators
// now show a Day-1 value plus a "Stabilized" annotation (the last scheduled
// income/expense/rate change, or year 5 if nothing is scheduled).

async function openHealthCheck(user) {
  const heading = screen.getByText('🩺 Purchase Health Check');
  const toggle = within(heading.parentElement).getByRole('button', { name: '▸ Show' });
  await user.click(toggle);
}

async function openIncomeForm(user) {
  await user.click(screen.getByRole('button', { name: /Income breakdown/ }));
  await user.click(screen.getByRole('button', { name: '+ Add' }));
}

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

function emergencyBufferRow() {
  return screen.getByText('Emergency Buffer').closest('div').parentElement;
}

describe('Purchase Health Check Stabilized annotation (TODO-134)', () => {
  it('shows a "stabilizes to" annotation with no schedule configured, falling back to year 5', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openHealthCheck(user);

    const row = emergencyBufferRow();
    expect(within(row).getByText(/stabilizes to/)).toBeInTheDocument();
    // Tooltip explains the fallback horizon (month 60 = year 5) when nothing
    // is scheduled - proves stabilizationMonth actually reached the render.
    expect(within(row).getByText(/reflects month 60/)).toBeInTheDocument();
  });

  it('a recurring salary raise scheduled at month 24 moves the Stabilized month to 24', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openIncomeForm(user);

    // Salary/Wages is already the default category - just needs its own
    // schedule pushed out to month 24 (recurrence defaults to monthly/forever).
    fireEvent.change(screen.getByLabelText('Weekly Amount ($)'), { target: { value: '500' } });
    const startSlider = within(screen.getByText(/Start Month:/).parentElement).getByRole('slider');
    fireEvent.change(startSlider, { target: { value: '24' } });
    await user.click(screen.getByRole('button', { name: 'Add Income' }));

    await openHealthCheck(user);
    const row = emergencyBufferRow();
    expect(within(row).getByText(/reflects month 24/)).toBeInTheDocument();
  });
});
