// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// TODO-167: offsetSimulation.js's early-out returns sentinel figures
// (years: 999, totalInterest: 999999) for a scenario where no money moves.
// Three display sites rendered them as real money, and none of the three was
// covered by any test - the whole point of this file.
//
// All three repros start the same way: config.default.json ships exactly ONE
// income source (Salary/Wages), and removing it satisfies the early-out's
// `incomeSources.length === 0` term. savingsInterestRate defaults to null, so
// TODO-50's `initialSavingsBalance > 0 && savingsInterestRate > 0` escape
// hatch does not fire either, and the sentinel does.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

async function removeTheOnlyIncomeSource(user) {
  await user.click(screen.getByRole('button', { name: /Income breakdown/ }));
  // Same gesture as App.incomeSources.test.jsx - reach the row's own ✕ through
  // the row rather than a bare query, so it can't hit an unrelated ✕.
  const row = screen.getByText('Salary/Wages').closest('div').parentElement;
  await user.click(within(row).getByRole('button', { name: '✕' }));
  expect(screen.queryByText('Salary/Wages')).not.toBeInTheDocument();
}

describe('Site 1: "saved in interest" (App.jsx interestSaved)', () => {
  // The subtraction is the trap: baselineSimulation always passes
  // `contributions: []` so it takes the early-out, while loanSimulation - which
  // has the contribution below - runs the real loop. 999999 minus a real
  // figure rendered "~$354,814 saved in interest" against a true saving of
  // $204.43.
  // The all-defaults form is already exactly TODO-167's repro: one $10,000
  // one-time contribution at month 1 (see App.expensesAndContributions.test.jsx,
  // which pins that default). Nothing to fill in.
  async function addDefaultOffsetContribution(user) {
    await user.click(screen.getByRole('button', { name: /Offset contributions breakdown/ }));
    const section = screen.getByText('💰 Offset Contributions Schedule').parentElement;
    await user.click(within(section).getByRole('button', { name: '+ Add' }));
    await user.click(screen.getByRole('button', { name: 'Add Contribution' }));
  }

  it('is suppressed when the baseline simulation hit the sentinel', async () => {
    const user = userEvent.setup();
    render(<App />);
    await removeTheOnlyIncomeSource(user);
    await addDefaultOffsetContribution(user);

    expect(screen.queryByText(/saved in interest/)).not.toBeInTheDocument();
  });

  it('still renders on a funded scenario, so the guard is not simply hiding the line', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addDefaultOffsetContribution(user);

    expect(screen.getByText(/saved in interest/)).toBeInTheDocument();
  });
});

describe('Site 2: the Strategy Comparison grid', () => {
  // Two separate opt-ins before the checkbox is even in the DOM: a master
  // toggle, then an expander (see App.projectionAssumptions.test.jsx). Both
  // checkboxes nest an InfoTooltip inside their <label>, so their accessible
  // name carries the whole tooltip text - a regex is required, not an exact
  // string.
  async function turnOnEtfInvesting(user) {
    await user.click(screen.getByRole('checkbox', { name: /^Show ETF investing options/ }));
    await user.click(screen.getByRole('button', { name: /ETF settings and strategy comparison/ }));
    await user.click(screen.getByRole('checkbox', { name: /^Invest in ETFs/ }));
  }

  it('is suppressed when every grid cell hit the sentinel', async () => {
    const user = userEvent.setup();
    render(<App />);
    await removeTheOnlyIncomeSource(user);
    await turnOnEtfInvesting(user);

    // The whole panel, not just the poisoned cell: "$999,999" was only half of
    // it. The crash scorer is handed 999999 - 999999 = 0 and 0 >= 0 scores as
    // maximum resilience, so the same row also claimed "🟢 50%".
    expect(screen.queryByText('🔍 Strategy Comparison')).not.toBeInTheDocument();
    expect(screen.queryByText('Interest Paid')).not.toBeInTheDocument();
    expect(screen.queryByText(/999,999/)).not.toBeInTheDocument();
  });

  it('still renders on a funded scenario, so the guard is not simply hiding the grid', async () => {
    const user = userEvent.setup();
    render(<App />);
    await turnOnEtfInvesting(user);

    expect(screen.getByText('🔍 Strategy Comparison')).toBeInTheDocument();
    expect(screen.getByText('Interest Paid')).toBeInTheDocument();
  });
});

describe('Site 3: Mortgage-Free Age', () => {
  async function optIntoMortgageFreeAge(user) {
    await user.click(screen.getByRole('button', { name: /Advanced Assumptions/ }));
    await user.click(screen.getByRole('checkbox', { name: /Show my Mortgage-Free Age/ }));
  }

  async function openHealthCheck(user) {
    const heading = screen.getByText('🩺 Purchase Health Check');
    await user.click(within(heading.parentElement).getByRole('button', { name: '▸ Show' }));
  }

  it('explains itself instead of rendering currentAge + 999', async () => {
    const user = userEvent.setup();
    render(<App />);
    await removeTheOnlyIncomeSource(user);
    await optIntoMortgageFreeAge(user);
    await openHealthCheck(user);

    // The bogus age classified 🔴 Late with `critical: false`, so it never
    // tripped the critical banner - it just sat there looking authoritative.
    expect(screen.queryByText(/^🔴 \d+$/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Mortgage-Free Age: not enough data yet/)
    ).toBeInTheDocument();
  });

  it('is still absent entirely while the opt-in checkbox is off', async () => {
    const user = userEvent.setup();
    render(<App />);
    await removeTheOnlyIncomeSource(user);
    await openHealthCheck(user);

    // Exact string, not a regex: an unrelated tooltip elsewhere on the page
    // mentions "Mortgage-Free Age" in prose, and matches a substring pattern.
    expect(screen.queryByText('Mortgage-Free Age')).not.toBeInTheDocument();
    expect(screen.queryByText(/Mortgage-Free Age: not enough data yet/)).not.toBeInTheDocument();
  });
});
