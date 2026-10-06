// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

async function openIncomeForm(user) {
  await user.click(screen.getByRole('button', { name: /Income breakdown/ }));
  await user.click(screen.getByRole('button', { name: '+ Add' }));
}

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('Income Name category-conditional rendering (TODO-56)', () => {
  it('shows the Shared Room sub-form only for Room Rent', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openIncomeForm(user);

    await user.selectOptions(screen.getByDisplayValue('Salary/Wages'), 'Room Rent');
    expect(screen.getByLabelText(/Shared room\?/)).toBeInTheDocument();

    await user.selectOptions(screen.getByDisplayValue('Room Rent'), 'House Rent');
    expect(screen.queryByLabelText(/Shared room\?/)).not.toBeInTheDocument();
  });

  it('checking Shared Room reveals the Number of People slider and a computed total', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openIncomeForm(user);
    await user.selectOptions(screen.getByDisplayValue('Salary/Wages'), 'Room Rent');

    expect(screen.queryByText(/Number of People:/)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/Shared room\?/));

    expect(screen.getByText(/Number of People:/)).toBeInTheDocument();
    expect(screen.getByLabelText('Weekly Rent per Person')).toBeInTheDocument();
    expect(screen.getByText(/Total: \$/)).toBeInTheDocument();
  });

  it('House Rent shows a plain Weekly Rent field only', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openIncomeForm(user);
    await user.selectOptions(screen.getByDisplayValue('Salary/Wages'), 'House Rent');

    expect(screen.getByLabelText('Weekly Rent')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Shared room\?/)).not.toBeInTheDocument();
  });

  // TODO-185: the generic field is per week for monthly income and per payment
  // otherwise - Bonus defaults to one-time, Child Support to monthly.
  it('any non-rental category shows the generic amount field, per payment when not monthly', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openIncomeForm(user);
    await user.selectOptions(screen.getByDisplayValue('Salary/Wages'), 'Bonus');
    expect(screen.getByLabelText('Amount per payment ($)')).toBeInTheDocument();

    await user.selectOptions(screen.getByDisplayValue('Bonus'), 'Child Support');
    expect(screen.getByLabelText('Weekly Amount ($)')).toBeInTheDocument();
  });

  // TODO-185: $50,000 was a generous ceiling for a weekly figure, but a real
  // limit for a single payment - a one-time Bonus above it was clamped.
  it('lets a per-payment amount go above the weekly ceiling', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openIncomeForm(user);
    await user.selectOptions(screen.getByDisplayValue('Salary/Wages'), 'Bonus');
    const field = screen.getByLabelText('Amount per payment ($)');
    fireEvent.change(field, { target: { value: '80000' } });
    fireEvent.blur(field);
    expect(field.value.replace(/[^0-9]/g, '')).toBe('80000');
  });

  it('Other reveals the free-text custom name input', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openIncomeForm(user);
    await user.selectOptions(screen.getByDisplayValue('Salary/Wages'), 'Other');

    expect(screen.getByPlaceholderText('e.g. Dividends, Side Business')).toBeInTheDocument();
  });
});

describe('Income Name category schedule defaults', () => {
  it('Bonus auto-sets One-Time on; Salary/Wages sets it back to Monthly/Forever', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openIncomeForm(user);

    await user.selectOptions(screen.getByDisplayValue('Salary/Wages'), 'Bonus');
    expect(screen.getByLabelText("One-Time (occurs once, doesn't repeat)")).toBeChecked();

    await user.selectOptions(screen.getByDisplayValue('Bonus'), 'Salary/Wages');
    expect(screen.getByLabelText("One-Time (occurs once, doesn't repeat)")).not.toBeChecked();
    expect(screen.getByText('End Month: Forever')).toBeInTheDocument();
  });
});

describe('Add Income form validation', () => {
  it('blank name (via Other with empty custom name) triggers the name alert', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openIncomeForm(user);
    await user.selectOptions(screen.getByDisplayValue('Salary/Wages'), 'Other');
    await user.click(screen.getByRole('button', { name: 'Add Income' }));
    expect(window.alert).toHaveBeenCalledWith('Please enter a name for the income source.');
  });

  it('amount <= 0 triggers the invalid-amount alert', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openIncomeForm(user);
    fireEvent.change(screen.getByLabelText('Weekly Amount ($)'), { target: { value: '0' } });
    fireEvent.blur(screen.getByLabelText('Weekly Amount ($)'));
    await user.click(screen.getByRole('button', { name: 'Add Income' }));
    expect(window.alert).toHaveBeenCalledWith('Please enter a valid amount.');
  });

  it('an inverted schedule range triggers the month-order alert', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openIncomeForm(user);
    // newIncomeOneTime defaults to false, so Start Month + End Month sliders
    // (and the recurrence buttons) are already visible without any clicks.
    // Order matters: the End Month slider's own `min` is bound to the current
    // Start Month, and a range input clamps its value the moment it's SET
    // above/below [min, max] - so lower End Month first (while Start's still
    // low), then raise Start Month after, or the End value gets clamped up
    // to match Start instead of staying below it.
    const endSlider = within(screen.getByText(/End Month:/).parentElement).getByRole('slider');
    fireEvent.change(endSlider, { target: { value: '10' } });
    const startSlider = within(screen.getByText(/Start Month:/).parentElement).getByRole('slider');
    fireEvent.change(startSlider, { target: { value: '50' } });

    await user.click(screen.getByRole('button', { name: 'Add Income' }));
    expect(window.alert).toHaveBeenCalledWith('Start month must be before end month.');
  });
});

describe('Add Income success + remove', () => {
  it('appends a row with the right name/schedule label and resets the form', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openIncomeForm(user);
    await user.selectOptions(screen.getByDisplayValue('Salary/Wages'), 'Bonus');
    fireEvent.change(screen.getByLabelText('Amount per payment ($)'), { target: { value: '200' } });
    fireEvent.blur(screen.getByLabelText('Amount per payment ($)'));
    await user.click(screen.getByRole('button', { name: 'Add Income' }));

    expect(screen.getByText('Bonus')).toBeInTheDocument();
    // Form resets back to defaults and collapses.
    expect(screen.queryByDisplayValue('Bonus')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument();
  });

  it('removing one income row via ✕ leaves the others intact', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openIncomeForm(user);
    await user.selectOptions(screen.getByDisplayValue('Salary/Wages'), 'Bonus');
    fireEvent.change(screen.getByLabelText('Amount per payment ($)'), { target: { value: '200' } });
    fireEvent.blur(screen.getByLabelText('Amount per payment ($)'));
    await user.click(screen.getByRole('button', { name: 'Add Income' }));

    // Two rows now: the default "Salary/Wages" source plus the new "Bonus" one.
    const bonusRow = screen.getByText('Bonus').closest('div').parentElement;
    await user.click(within(bonusRow).getByRole('button', { name: '✕' }));

    expect(screen.queryByText('Bonus')).not.toBeInTheDocument();
    expect(screen.getByText('Salary/Wages')).toBeInTheDocument();
  });
});
