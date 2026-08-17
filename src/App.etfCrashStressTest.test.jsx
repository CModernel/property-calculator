// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// TODO-145: the market-drop stress test. Its central claim is that a crash
// cannot touch the loan, so the App-level test that matters most is the one
// proving the headline figures really don't move.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

async function openEtfControls(user) {
  await user.click(screen.getByRole('checkbox', { name: /^Show ETF investing options/ }));
  await user.click(screen.getByRole('button', { name: /ETF settings and strategy comparison/ }));
  await user.click(screen.getByRole('checkbox', { name: /^Invest in ETFs/ }));
}

const setAllocation = (pct) => {
  const input = screen.getByLabelText('ETF Allocation');
  fireEvent.change(input, { target: { value: String(pct) } });
  fireEvent.blur(input);
};

describe('ETF market-drop stress test (TODO-145)', () => {
  it('is hidden at a 0% allocation, where every column would read the same', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfControls(user);
    setAllocation(0);

    expect(screen.queryByText(/What if the market drops\?/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Crash month')).not.toBeInTheDocument();
  });

  it('appears once some surplus is actually being diverted to the ETF', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfControls(user);
    setAllocation(50);

    expect(screen.getByText(/What if the market drops\?/)).toBeInTheDocument();
    expect(screen.getByLabelText('Crash month')).toBeInTheDocument();
    // The no-crash baseline plus the three severities.
    for (const label of ['No crash', '-20%', '-30%', '-40%']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  // The load-bearing test: the crash must not reach the loan side.
  it('leaves Time to pay off and Total interest paid untouched as the crash month moves', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfControls(user);
    setAllocation(50);

    const readLoanFigures = () => ({
      payoff: screen.getByText('Time to pay off:').parentElement.textContent,
      interest: screen.getByText('Total interest paid:').parentElement.textContent,
    });

    const before = readLoanFigures();
    const crashMonthInput = screen.getByLabelText('Crash month');
    fireEvent.change(crashMonthInput, { target: { value: '12' } });
    fireEvent.blur(crashMonthInput);

    expect(readLoanFigures()).toEqual(before);
  });

  it('always states why the loan is unaffected', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfControls(user);
    setAllocation(50);

    expect(screen.getByText(/never sells ETF units to service the mortgage/)).toBeInTheDocument();
  });

  // Direction confirmed by measuring the engine, not assumed: the balance keeps
  // growing from contributions, so a later drop takes a slice of a bigger number.
  it('a later crash reports a bigger net-worth loss than an earlier one', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfControls(user);
    setAllocation(50);

    const crashMonthInput = screen.getByLabelText('Crash month');
    // Scoped to the crash table via its own caption - an unscoped query picks up
    // negative dollar figures from other panels (the default scenario's -$680 of
    // personal expenses, for one).
    const readWorstGap = () => {
      const table = screen.getByText(/^Outcome after a one-off ETF market drop/).closest('table');
      const gaps = within(table).getAllByText(/^-\$[\d,]+$/);
      return Math.abs(Number(gaps[gaps.length - 1].textContent.replace(/[-$,]/g, '')));
    };

    fireEvent.change(crashMonthInput, { target: { value: '12' } });
    fireEvent.blur(crashMonthInput);
    const earlyLoss = readWorstGap();

    fireEvent.change(crashMonthInput, { target: { value: '120' } });
    fireEvent.blur(crashMonthInput);
    const lateLoss = readWorstGap();

    expect(lateLoss).toBeGreaterThan(earlyLoss);
  });
});
