// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Money scheduled into the offset account leaves the bank but stays the
// buyer's, and stays fully liquid - offsetSimulation.js itself draws the offset
// down first to cover a deficit month. So committing cash to the offset must
// not shrink the Emergency/Vacancy Buffers, which ask "how long could you last
// with no income". Before this was fixed, adding the add-form's default $10,000
// one-time contribution dropped the Emergency Buffer from 6.3 to 4.1 months and
// flipped it from green to orange, purely because both indicators divided
// `cashRemaining` (which correctly subtracts the commitment for its own,
// different question: how much UNCOMMITTED cash is left).

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

async function openHealthCheck(user) {
  const heading = screen.getByText('🩺 Purchase Health Check');
  await user.click(within(heading.parentElement).getByRole('button', { name: '▸ Show' }));
}

async function addDefaultOneTimeContribution(user) {
  await user.click(screen.getByRole('button', { name: /Offset contributions breakdown/ }));
  const section = screen.getByText('💰 Offset Contributions Schedule').parentElement;
  await user.click(within(section).getByRole('button', { name: '+ Add' }));
  await user.click(screen.getByRole('button', { name: 'Add Contribution' }));
}

// Anchored on the classification symbol so this matches ONLY the indicator's
// own value span - the row also contains a "stabilizes to X months" annotation
// (TODO-134) and a tooltip whose band text says "months" several times.
// Returning symbol + value together means a green->orange flip fails too, not
// just a change in the number.
function readBuffer(label) {
  const row = screen.getByText(label).closest('div');
  // Alternation, not a [...] class: these emoji are surrogate pairs, so a
  // character class would match half-surrogates instead of the symbols.
  return within(row).getByText(/^(🟢|🟡|🟠|🔴) (\d+\.\d+ months|∞)$/).textContent;
}

describe('offset commitments and the liquidity-based buffers', () => {
  it('a one-time offset contribution leaves the Emergency Buffer unchanged', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openHealthCheck(user);
    const before = readBuffer('Emergency Buffer');

    await addDefaultOneTimeContribution(user);
    expect(screen.getByText(/One-Time Contributions Total:/)).toHaveTextContent('$10,000');

    expect(readBuffer('Emergency Buffer')).toBe(before);
  });

  it('the same contribution still reduces Cash Remaining, which answers a different question', async () => {
    const user = userEvent.setup();
    render(<App />);

    await addDefaultOneTimeContribution(user);

    // The upfront-costs panel subtracts the commitment on purpose: that cash
    // genuinely is no longer sitting uncommitted in the bank.
    expect(screen.getByText(`-$10,000`)).toBeInTheDocument();
  });
});
