// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('First Home Buyer / Investment Property mutual exclusion (TODO-38/44)', () => {
  it('starts with Investment Property disabled, since the default scenario has First Home Buyer checked', () => {
    render(<App />);
    expect(screen.getByLabelText('Investment Property')).toBeDisabled();
    expect(screen.getByLabelText('First Home Buyer (NSW stamp duty concession)')).not.toBeDisabled();
  });

  it('unchecking First Home Buyer enables Investment Property', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText('First Home Buyer (NSW stamp duty concession)'));
    expect(screen.getByLabelText('Investment Property')).not.toBeDisabled();
  });

  it('checking Investment Property (with FHB off) disables FHB and seeds Land Tax/Property Management', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText('First Home Buyer (NSW stamp duty concession)')); // turn FHB off first
    await user.click(screen.getByLabelText('Investment Property'));

    expect(screen.getByLabelText('First Home Buyer (NSW stamp duty concession)')).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Property expenses breakdown/ }));
    expect(screen.getByLabelText('Land Tax (yearly)')).toHaveValue(2000);
    expect(screen.getByLabelText('Property Management (monthly)')).toHaveValue(150);
  });

  it('re-checking Investment Property does not re-seed Land Tax once it has a non-zero value', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText('First Home Buyer (NSW stamp duty concession)')); // off
    await user.click(screen.getByLabelText('Investment Property')); // on -> seeds Land Tax to 2000
    await user.click(screen.getByRole('button', { name: /Property expenses breakdown/ }));

    fireEvent.change(screen.getByLabelText('Land Tax (yearly)'), { target: { value: '5000' } });
    fireEvent.blur(screen.getByLabelText('Land Tax (yearly)'));

    await user.click(screen.getByLabelText('Investment Property')); // off - value stays in state, field just hides
    await user.click(screen.getByLabelText('Investment Property')); // on again

    // handleInvestmentPropertyChange only seeds when base === 0 - since it's
    // 5000 now, re-checking must not reset it back to the 2000 default.
    expect(screen.getByLabelText('Land Tax (yearly)')).toHaveValue(5000);
    expect(screen.getByLabelText('First Home Buyer (NSW stamp duty concession)')).toBeDisabled();
  });

  it('Foreign Purchaser is never disabled by First Home Buyer or Investment Property state', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByLabelText('Foreign Purchaser')).not.toBeDisabled();

    await user.click(screen.getByLabelText('First Home Buyer (NSW stamp duty concession)')); // FHB off
    await user.click(screen.getByLabelText('Investment Property')); // Investment on
    expect(screen.getByLabelText('Foreign Purchaser')).not.toBeDisabled();

    await user.click(screen.getByLabelText('Investment Property')); // Investment off
    await user.click(screen.getByLabelText('First Home Buyer (NSW stamp duty concession)')); // FHB on
    expect(screen.getByLabelText('Foreign Purchaser')).not.toBeDisabled();
  });

  it('checking Foreign Purchaser reveals the Foreign Purchaser Surcharge line; unchecking hides it', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByText('Foreign Purchaser Surcharge (8%):')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Foreign Purchaser'));
    expect(screen.getByText('Foreign Purchaser Surcharge (8%):')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Foreign Purchaser'));
    expect(screen.queryByText('Foreign Purchaser Surcharge (8%):')).not.toBeInTheDocument();
  });
});

describe('LMI "Pay LMI upfront" checkbox visibility (gated on LVR > 80%)', () => {
  it('is absent at the default ~64% LVR, appears above 80% LVR, and disappears again below it', () => {
    render(<App />);
    expect(screen.queryByLabelText(/Pay LMI upfront in cash/)).not.toBeInTheDocument();

    // Lower the deposit until LVR exceeds 80% ($100k deposit on $850k price -> ~88.2% LVR).
    fireEvent.change(screen.getByLabelText('Deposit Contribution'), { target: { value: '100000' } });
    fireEvent.blur(screen.getByLabelText('Deposit Contribution'));
    expect(screen.getByLabelText(/Pay LMI upfront in cash/)).toBeInTheDocument();

    // Raise it back above the 80% threshold.
    fireEvent.change(screen.getByLabelText('Deposit Contribution'), { target: { value: '307000' } });
    fireEvent.blur(screen.getByLabelText('Deposit Contribution'));
    expect(screen.queryByLabelText(/Pay LMI upfront in cash/)).not.toBeInTheDocument();
  });
});

describe('Property Price / Deposit / Loan Amount invariants', () => {
  it('lowering Property Price below the current Deposit clamps Deposit down to match', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Property Price'), { target: { value: '200000' } });
    fireEvent.blur(screen.getByLabelText('Property Price'));
    // Default deposit (307000) exceeds the new price (200000), so it must clamp.
    expect(screen.getByLabelText('Deposit Contribution')).toHaveValue(200000);
  });

  it('editing Loan Amount translates into the correct Deposit (two-way binding)', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Loan Amount'), { target: { value: '600000' } });
    fireEvent.blur(screen.getByLabelText('Loan Amount'));
    // Deposit = propertyPrice (850000) - loanAmount (600000)
    expect(screen.getByLabelText('Deposit Contribution')).toHaveValue(250000);
  });
});
