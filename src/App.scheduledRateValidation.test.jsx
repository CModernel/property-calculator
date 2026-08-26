// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import App from './App';

// TODO-169: a scheduled interest-rate change used to skip validation
// entirely - useSteppedValue.addChange only checked for a duplicate
// startMonth, and SteppedExpenseField's "New amount" input had no min/max.
// A 0% (or negative) scheduled rate NaNs the whole loan simulation from that
// month onward, producing a fabricated "Time to pay off" and "$NaN" total
// interest that isn't caught by the existing '30+' years fallback.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

// The Interest Rate field (Financial Position, TODO-57) is the first
// SteppedExpenseField on the page - see App.expensesAndContributions.test.jsx.
function openInterestRateScheduleForm() {
  fireEvent.click(screen.getAllByRole('button', { name: '+ Schedule a change' })[0]);
  return screen.getByText('New amount').closest('div').parentElement;
}

function setScheduledChange(scheduleForm, amount, startMonth) {
  const newAmountInput = within(scheduleForm).getByRole('spinbutton');
  fireEvent.change(newAmountInput, { target: { value: String(amount) } });
  const monthSlider = within(screen.getByText(/Starting month:/).parentElement).getByRole('slider');
  fireEvent.change(monthSlider, { target: { value: String(startMonth) } });
}

describe('Scheduled interest-rate change validation (TODO-169)', () => {
  it('rejects a 0% scheduled rate change and leaves "Total interest paid" a real number', () => {
    render(<App />);
    const scheduleForm = openInterestRateScheduleForm();
    setScheduledChange(scheduleForm, 0, 25);
    fireEvent.click(screen.getByRole('button', { name: 'Add scheduled change' }));

    expect(window.alert).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/from month 25/)).not.toBeInTheDocument();

    const totalInterestLabel = screen.getByText('Total interest paid:');
    expect(totalInterestLabel.parentElement.textContent).not.toMatch(/NaN/);
  });

  it('rejects a negative scheduled rate change', () => {
    render(<App />);
    const scheduleForm = openInterestRateScheduleForm();
    setScheduledChange(scheduleForm, -1, 25);
    fireEvent.click(screen.getByRole('button', { name: 'Add scheduled change' }));

    expect(window.alert).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/from month 25/)).not.toBeInTheDocument();
  });

  it('still accepts an in-range scheduled rate change', () => {
    render(<App />);
    const scheduleForm = openInterestRateScheduleForm();
    setScheduledChange(scheduleForm, 5, 25);
    fireEvent.click(screen.getByRole('button', { name: 'Add scheduled change' }));

    expect(window.alert).not.toHaveBeenCalled();
    // INTEREST_RATE_FIELD has no `prefix` (see coreFieldConfigs.js), so the
    // scheduled-change row renders as a bare number, not "5% p.a.".
    expect(screen.getByText('5 from month 25')).toBeInTheDocument();
  });
});
