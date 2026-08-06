// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('Property Type (house vs unit)', () => {
  it('shows the "No strata" message for house, hides it for unit', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText("No strata - houses aren't on a shared title.")).toBeInTheDocument();

    await user.selectOptions(screen.getByDisplayValue('House'), 'Unit / Apartment');
    expect(screen.queryByText("No strata - houses aren't on a shared title.")).not.toBeInTheDocument();
  });

  it('switching to unit seeds Strata to $1000 when it started at 0', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByDisplayValue('House'), 'Unit / Apartment');
    await user.click(screen.getByRole('button', { name: /Property expenses breakdown/ }));
    expect(screen.getByLabelText('Strata (quarterly)')).toHaveValue(1000);
  });

  it('switching back to house and then to unit again does not re-seed a bumped Strata value', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByDisplayValue('House'), 'Unit / Apartment');
    await user.click(screen.getByRole('button', { name: /Property expenses breakdown/ }));

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(screen.getByLabelText('Strata (quarterly)'), { target: { value: '3000' } });
    fireEvent.blur(screen.getByLabelText('Strata (quarterly)'));

    await user.selectOptions(screen.getByDisplayValue('Unit / Apartment'), 'House');
    await user.selectOptions(screen.getByDisplayValue('House'), 'Unit / Apartment');

    expect(screen.getByLabelText('Strata (quarterly)')).toHaveValue(3000);
  });
});

describe('Investment Property gates Land Tax / Property Management fields', () => {
  it('hides Land Tax/Property Management when off, reveals them when checked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Property expenses breakdown/ }));
    expect(screen.queryByLabelText('Land Tax (yearly)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Property Management (monthly)')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('First Home Buyer (NSW stamp duty concession)')); // off, unblocks Investment Property
    await user.click(screen.getByLabelText('Investment Property'));

    expect(screen.getByLabelText('Land Tax (yearly)')).toBeInTheDocument();
    expect(screen.getByLabelText('Property Management (monthly)')).toBeInTheDocument();
  });
});

describe('Property Summary card visibility (TODO-42)', () => {
  it('is absent by default (no rental income), appears after adding House Rent, disappears after removing it', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByText('📊 Property Summary')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Income breakdown/ }));
    await user.click(screen.getByRole('button', { name: '+ Add' }));
    await user.selectOptions(screen.getByDisplayValue('Salary/Wages'), 'House Rent');
    await user.click(screen.getByRole('button', { name: 'Add Income' }));

    expect(screen.getByText('📊 Property Summary')).toBeInTheDocument();

    const houseRentRow = screen.getByText('House Rent').closest('div').parentElement;
    await user.click(within(houseRentRow).getByRole('button', { name: '✕' }));
    expect(screen.queryByText('📊 Property Summary')).not.toBeInTheDocument();
  });
});

describe('Independent show* toggles (input panel vs. results panel)', () => {
  it('showPropertyExpenses/showPersonalExpenses (input panel) do not affect showMonthlyExpensesBreakdown/showPersonalExpensesBreakdown (results panel), or vice versa', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Expand the results-panel "Personal Expenses" breakdown.
    await user.click(screen.getByRole('button', { name: /▸ Personal Expenses:/ }));
    expect(screen.getByText('Groceries:')).toBeInTheDocument();

    // The separate input-panel "Personal expenses breakdown" toggle is unaffected.
    expect(screen.getByRole('button', { name: /Personal expenses breakdown \(subtotal/ })).toHaveTextContent('▸');

    // And expanding the input-panel toggle doesn't collapse the results-panel one.
    await user.click(screen.getByRole('button', { name: /Personal expenses breakdown \(subtotal/ }));
    expect(screen.getByText('Groceries:')).toBeInTheDocument();
  });
});
