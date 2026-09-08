// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { serializeScenarioPayload } from './persistence/scenarioStorage';

const STORAGE_KEY = 'propertyCalculator.scenario';

// TODO-176: `App.jsx` builds `baselineSimulation` as a copy of
// `loanSimulation` with `contributions: []`, so that
// `interestSaved = baseline.totalInterest - loan.totalInterest` can answer
// "how much did my scheduled contributions save me?". But both bundles passed
// `initialSavingsBalance: cashRemaining`, which has already had
// `totalScheduledOffset` subtracted - handing the arm that makes NO
// contributions a bank balance reduced by those contributions. It answered
// "you paid them and never used them" rather than "you never made them".
//
// It is the only one of the nine engine call sites where `contributions` and
// `initialSavingsBalance` disagree about whether the contributions happen.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

async function openContributionsAndAddDefault(user) {
  await user.click(screen.getByRole('button', { name: /Offset contributions breakdown/ }));
  const section = screen.getByText('💰 Offset Contributions Schedule').parentElement;
  await user.click(within(section).getByRole('button', { name: '+ Add' }));
  // The all-defaults form is one $10,000 one-time contribution at month 1.
  await user.click(screen.getByRole('button', { name: 'Add Contribution' }));
}

describe('The "saved in interest" figure (TODO-176)', () => {
  // This figure had NO value assertion anywhere before this test - only two
  // presence/absence checks in App.sentinelNeverRenders.test.jsx - so it could
  // move by any amount with the whole suite green. Measured against the real
  // render, not derived by hand.
  it('is pinned on the shipped default plus one $10,000 one-time contribution', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openContributionsAndAddDefault(user);

    expect(screen.getByText(/~\$7,160 saved in interest/)).toBeInTheDocument();
  });
});

describe('The baseline arm keeps the cash it never spent (TODO-176)', () => {
  // The scenario where the seed's SIGN decides whether the figure exists at
  // all, which is what makes this fix observable: the engine's sentinel
  // early-out tests `initialSavingsBalance > 0`, not its magnitude.
  //
  // A $40,000 one-time contribution against the shipped default's $28,453 of
  // leftover cash drives `cashRemaining` to -$11,547 while `liquidSavings`
  // stays at $28,453. With no income sources and a negative surplus, the other
  // three sentinel clauses hold for the baseline arm too (it passes
  // `contributions: []`, so its contribution sum is 0).
  //
  // Seeded with the negative `cashRemaining` the baseline tripped the sentinel,
  // `hasUsableProjection` came back false, and TODO-167's guard suppressed the
  // line entirely. Seeded with `liquidSavings` it escapes via TODO-50 (a
  // positive balance earning a nonzero rate), runs the real loop, and the
  // figure appears - correctly, because that baseline genuinely has $28,453 in
  // the bank earning interest.
  async function renderOverCommitted() {
    localStorage.setItem(STORAGE_KEY, serializeScenarioPayload({
      incomeSources: [],
      savingsInterestRate: 4,
      offsetContributions: [{ id: 1, name: 'Lump', amount: 40000, startMonth: 1, recurrence: 'none', endMonth: 1 }],
    }));
    vi.resetModules();
    const { default: FreshApp } = await import('./App');
    render(<FreshApp />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Offset contributions breakdown/ }));
  }

  it('still produces a usable baseline when the contributions overshot the leftover cash', async () => {
    await renderOverCommitted();

    // Confirms the scenario really is over-committed before trusting the rest.
    expect(screen.getByText(/-\$11,547/)).toBeInTheDocument();
    expect(screen.getByText(/~\$4,925 saved in interest/)).toBeInTheDocument();
  });
});
