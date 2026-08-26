// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { classifyOffsetUtilisation } from './calculations/purchaseHealthCheck';

// TODO-164: Mortgage-Free Age and Offset Utilisation existed only in
// purchaseHealthCheck.test.js's unit tests - neither was ever rendered by any
// test in the tree, so a wiring defect in either one could ship green.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('Mortgage-Free Age render (TODO-164)', () => {
  it('equals currentAge plus the loan simulation\'s own payoff duration - not a raw month count', async () => {
    const user = userEvent.setup();
    render(<App />);

    // App.jsx:914 feeds this indicator `loanSimulation.years`, a SIMULATION
    // OUTPUT (offset-accelerated payoff, can be well under the nominal loan
    // term) - not `loanTermYears`. Reading the same figure the app already
    // renders elsewhere ("Time to pay off: X years") rather than re-deriving
    // it by hand means this test can't drift from the simulation's own
    // arithmetic, and still catches the defect this TODO names: swapping in
    // `.months` (a raw month count, ~12x too large) would fail by hundreds,
    // not by a rounding hair.
    const payoffYears = Number(screen.getByText('Time to pay off:').parentElement.textContent.match(/[\d.]+/)[0]);

    await user.click(screen.getByRole('button', { name: /Advanced Assumptions/ }));
    await user.click(screen.getByRole('checkbox', { name: /Show my Mortgage-Free Age/ }));
    const ageInput = screen.getByLabelText('Your Current Age');
    await user.clear(ageInput);
    await user.type(ageInput, '35');
    await user.tab();

    const heading = screen.getByText('🩺 Purchase Health Check');
    await user.click(within(heading.parentElement).getByRole('button', { name: '▸ Show' }));
    const row = screen.getByText('Mortgage-Free Age').closest('div').parentElement;
    const renderedAge = Number(within(row).getByText(/^🟢 \d+$|^🟡 \d+$|^🟠 \d+$|^🔴 \d+$/).textContent.match(/\d+/)[0]);

    // Small tolerance for the one-decimal-place figure read off the page
    // (currentAge + years, rounded) - a genuine field-swap defect (months
    // instead of years) misses by orders of magnitude more than this.
    expect(renderedAge).toBeGreaterThanOrEqual(Math.round(35 + payoffYears) - 1);
    expect(renderedAge).toBeLessThanOrEqual(Math.round(35 + payoffYears) + 1);
  });

  it('is not rendered while the opt-in checkbox is off', async () => {
    render(<App />);
    expect(screen.queryByText('Mortgage-Free Age')).not.toBeInTheDocument();
  });
});

describe('Offset Utilisation render (TODO-164)', () => {
  function offsetUtilisationRow() {
    return screen.getByText('Offset Utilisation (this month)').closest('div').parentElement;
  }

  // The symbol and value share one <span> as adjacent text nodes (same shape
  // as every other Health Check indicator's primary value).
  function primaryValue(row) {
    return within(row).getByText((_, node) => node?.className?.includes('font-semibold') && node.tagName === 'SPAN').textContent;
  }

  it('the value and the classification agree, at two different months', async () => {
    render(<App />);
    const monthSlider = screen.getByLabelText('Viewing month');

    for (const month of [0, 240]) {
      fireEvent.change(monthSlider, { target: { value: String(month) } });

      const value = primaryValue(offsetUtilisationRow());
      const [symbol, pctText] = value.split(' ');
      const pct = Number(pctText.replace('%', ''));
      // classifyOffsetUtilisation is the same function App.jsx calls for the
      // classification - this isn't a second re-derivation of the math, just
      // confirming the DISPLAYED number and the DISPLAYED colour were derived
      // from that same number, not from two independent calls that could
      // silently drift onto different arguments (App.jsx used to call
      // calculateOffsetUtilisation twice, with identical arguments, once for
      // each - an argument-order slip in either call would have gone unnoticed
      // forever with no test rendering this indicator at all).
      expect(symbol).toBe(classifyOffsetUtilisation(pct).symbol);
    }
  });

  // Argument-order sanity, independent of the classifyOffsetUtilisation
  // cross-check above: offset accumulates from month 1 while the loan balance
  // shrinks, so utilisation must be materially higher late than at month 0. A
  // swapped (balance, offset) call would invert this direction.
  it('rises over time as the offset grows relative to the shrinking balance', async () => {
    render(<App />);
    const monthSlider = screen.getByLabelText('Viewing month');

    fireEvent.change(monthSlider, { target: { value: '0' } });
    const early = Number(primaryValue(offsetUtilisationRow()).split(' ')[1].replace('%', ''));

    fireEvent.change(monthSlider, { target: { value: '240' } });
    const late = Number(primaryValue(offsetUtilisationRow()).split(' ')[1].replace('%', ''));

    expect(late).toBeGreaterThan(early);
  });
});
