// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// TODO-168: `offsetSimulation.js` had a `balance = 0` that ran AFTER the
// month's row was already pushed and immediately before a `break`, so nothing
// could ever observe it. The shipped default therefore reported months: 108
// ("Time to pay off: 9.0 years") while the Timeline Explorer at its End
// position rendered "🏦 Loan: $357,095" for that same loan.
//
// Nothing in the suite covered this surface at all - grepping the tree for
// "🏦 Loan", "Net Effective Balance" or "Time to pay off" found no assertion
// anywhere, which is why it shipped.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('The Timeline Explorer at the payoff month (TODO-168)', () => {
  it('shows the loan retired, agreeing with the "Time to pay off" headline above it', () => {
    render(<App />);

    // The slider's max IS the simulation's payoff month (App.jsx sets
    // max={loanSimulation.months}), so this is the month the headline names.
    const monthSlider = screen.getByLabelText('Viewing month');
    fireEvent.change(monthSlider, { target: { value: monthSlider.max } });

    expect(screen.getByText(/🏦 Loan: \$0$/)).toBeInTheDocument();
    // The panel already said "0 Years, 0 Months" remaining here; now the loan
    // figure beside it agrees instead of contradicting it. Scoped through the
    // heading because several unrelated $0 figures exist on the page.
    const netEffective = screen.getByText('Net Effective Balance').parentElement;
    expect(within(netEffective).getByText(/^\$0$/)).toBeInTheDocument();
  });

  it('still shows a live balance before the loan is retired', () => {
    render(<App />);
    const monthSlider = screen.getByLabelText('Viewing month');
    fireEvent.change(monthSlider, { target: { value: '1' } });

    // Guards against a fix that simply zeroes the loan line everywhere.
    expect(screen.queryByText(/🏦 Loan: \$0$/)).not.toBeInTheDocument();
  });
});

describe('The Strategy Comparison table marks a finished strategy (TODO-168)', () => {
  const COMPARISON_HEADING = '⚖️ Offset vs ETF, side by side';

  async function openComparison(user) {
    await user.click(screen.getByRole('checkbox', { name: /^Show ETF investing options/ }));
    await user.click(screen.getByRole('button', { name: /ETF settings and strategy comparison/ }));
    await user.click(screen.getByRole('checkbox', { name: /^Invest in ETFs/ }));
  }

  function comparisonSection() {
    return screen.getByText(COMPARISON_HEADING).closest('div').parentElement;
  }

  it('says a strategy paid off instead of printing its frozen figure', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openComparison(user);

    // The axis runs to the SLOWEST strategy's payoff, so "Offset only" - which
    // finishes first - is past its own end in the later rows. It used to print
    // a stale dollar amount there, which read as a live one and made the
    // fastest-paying strategy look like the most indebted.
    const section = comparisonSection();
    const settled = within(section).getAllByText(/paid off m\d+/);
    expect(settled.length).toBeGreaterThan(0);
  });

  it('still prints real figures for a strategy that is still running', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openComparison(user);

    // Guards against a marker that swallows every cell: the slowest strategy
    // defines the axis, so it is never past its own end and every one of its
    // cells must still carry a number.
    const section = comparisonSection();
    const rows = within(section).getAllByRole('row');
    const lastRow = rows[rows.length - 1];
    // Columns are [month, Offset only, Your split, All to ETF].
    const allEtfCell = within(lastRow).getAllByRole('cell')[3];
    expect(allEtfCell.textContent).toMatch(/^\$[\d,]+$/);
  });
});
