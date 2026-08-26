// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// The Stabilized Interest Rate Stress Test re-amortizes at rate+1/2/3 and
// compares the result against projectedTotalPropertyCost, which is built from
// projected.monthlyPayment. Those two payments must be amortized over the SAME
// term. They weren't: the baseline used the remaining term
// (projectedHealthCheck.js's `totalMonths - month + 1`) while the stress test
// was handed the full `totalMonths`. A longer term makes an installment
// CHEAPER, so a big enough term gap outweighed a full 3-point rate rise and the
// panel reported "Survives +3%" for a month the app had already computed as
// being in deficit at the unstressed rate - the value and the deficit flag on
// the same row asserting opposite things.
//
// Scenario below: $800k loan, 6% base, a scheduled rise to 8% at month 300.
// Stabilized month is therefore 300, leaving 61 months, and:
//   baseline  pay($800k, 8%, 61)  = $16,003/mo  -> deficit at ~$13.5k income
//   +3 stress pay($800k, 11%, 360) = $7,619/mo  -> "survives", the bug
//   +1 stress pay($800k, 9%, 61)   = $16,392/mo -> fails, the correct answer
// Income sits far inside that window on both sides, so the test is not
// knife-edge on any rounding.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

async function openHealthCheck(user) {
  const heading = screen.getByText('🩺 Purchase Health Check');
  await user.click(within(heading.parentElement).getByRole('button', { name: '▸ Show' }));
}

function stressTestRow() {
  return screen.getByText('Interest Rate Stress Test').closest('div').parentElement;
}

// SteppedExpenseField wraps a NumberSliderField plus its own "+ Schedule a
// change" form, and seven of these exist on the page - so walk up from the
// labelled input until the wrapper that owns that button is found, rather
// than guessing a fixed number of parentElement hops.
function steppedFieldFor(labelText) {
  let node = screen.getByLabelText(labelText).closest('div');
  while (node && !within(node).queryByRole('button', { name: '+ Schedule a change' })) {
    node = node.parentElement;
  }
  return node;
}

async function scheduleRateChange(user, newRate, startMonth) {
  const field = steppedFieldFor('Interest Rate');
  await user.click(within(field).getByRole('button', { name: '+ Schedule a change' }));
  // SteppedExpenseField's form labels carry no htmlFor, so reach each input
  // through its own label's wrapper rather than getByLabelText.
  const amountInput = within(field).getByText('New amount').parentElement.querySelector('input');
  fireEvent.change(amountInput, { target: { value: String(newRate) } });
  const monthSlider = within(within(field).getByText(/Starting month:/).parentElement).getByRole('slider');
  fireEvent.change(monthSlider, { target: { value: String(startMonth) } });
  await user.click(within(field).getByRole('button', { name: 'Add scheduled change' }));
}

// Growth compounds hard over 300 months and would make the income figure
// non-obvious; the term bug has nothing to do with growth, so it is removed.
function zeroGrowthRates() {
  for (const label of ['Salary Growth Rate', 'Rent Growth Rate', 'Expense Growth Rate']) {
    fireEvent.change(screen.getByLabelText(label), { target: { value: '0' } });
    fireEvent.blur(screen.getByLabelText(label));
  }
}

async function addIncome(user, weeklyAmount) {
  await user.click(screen.getByRole('button', { name: /Income breakdown/ }));
  await user.click(screen.getByRole('button', { name: '+ Add' }));
  fireEvent.change(screen.getByLabelText('Weekly Amount ($)'), { target: { value: String(weeklyAmount) } });
  await user.click(screen.getByRole('button', { name: 'Add Income' }));
}

describe('Stabilized Interest Rate Stress Test amortization term', () => {
  it('reports "Already in deficit" rather than surviving a rate rise it cannot survive', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Projection assumptions/ }));
    zeroGrowthRates();

    fireEvent.change(screen.getByLabelText('Loan Amount'), { target: { value: '800000' } });
    fireEvent.blur(screen.getByLabelText('Loan Amount'));
    fireEvent.change(screen.getByLabelText('Interest Rate'), { target: { value: '6' } });
    fireEvent.blur(screen.getByLabelText('Interest Rate'));
    await scheduleRateChange(user, 8, 300);
    await addIncome(user, 1500);

    await openHealthCheck(user);
    const row = stressTestRow();

    // The Stabilized month really is the scheduled change, not the year-5
    // fallback - otherwise this scenario proves nothing.
    expect(within(row).getByText(/reflects month 300/)).toBeInTheDocument();

    const stabilized = within(row).getByText(/stabilizes to/).textContent;
    expect(stabilized).toContain('Already in deficit');
    // The specific wrong reading the full-term amortization produced.
    expect(stabilized).not.toMatch(/Survives \+\d%/);
  });
});
