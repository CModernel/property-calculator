// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Regression tests for two bugs TODO-144 introduced and its own tests missed:
// App.jsx builds six separate parameter bundles for calculateLoanWithOffset, and
// TODO-144 only wired the start-timing gates into three of them. The panels
// beneath the headline projection therefore simulated a different strategy than
// the projection itself.
//
// The original tests missed this because they either exercised the engine
// directly (where the params were right) or checked the selector's DOM
// behaviour. Nothing asserted that the PANELS agree with the PROJECTION - so
// that is what these assert, rather than checking each bundle's params, which
// would rot the moment a seventh bundle appears.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

async function openEtfControls(user) {
  await user.click(screen.getByRole('checkbox', { name: /^Show ETF investing options/ }));
  await user.click(screen.getByRole('button', { name: /ETF settings and strategy comparison/ }));
  await user.click(screen.getByRole('checkbox', { name: /^Invest in ETFs/ }));
}

const setField = (label, value) => {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.blur(input);
};

// The Return Sensitivity panel's own table, scoped by its caption so nothing
// else on the page can satisfy the query.
function sensitivityEtfBalance() {
  const table = screen.getByText(/^Outcome at three assumed ETF returns$/).closest('table');
  const row = within(table).getByText('ETF balance').closest('tr');
  // Columns are Conservative / Your assumption / Favourable - take the middle.
  return within(row).getAllByText(/^\$[\d,]+$/)[1].textContent;
}

describe('ETF start-timing gates reach every panel (TODO-144 regression)', () => {
  // Bug B: the new gates never reached the Sensitivity panel, so it invested
  // from month 1 regardless of the delay the user asked for.
  it('a delayed start changes the Return Sensitivity panel, not just the headline projection', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfControls(user);
    setField('ETF Allocation', 50);

    const immediate = sensitivityEtfBalance();

    await user.click(screen.getByRole('radio', { name: /After a set number of months/ }));
    setField('Start from month', 60);

    expect(sensitivityEtfBalance()).not.toBe(immediate);
  });

  // Bug A: the raw switchThresholdPct leaked into the panel, so a threshold the
  // user had switched away from kept gating their projection there.
  it('switching away from the loan-% criterion stops it affecting the Sensitivity panel', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfControls(user);
    setField('ETF Allocation', 50);

    // A high threshold that heavily delays investing.
    await user.click(screen.getByRole('radio', { name: /reaches a share of the loan/ }));
    setField('Switch Trigger', 90);
    const gatedByThreshold = sensitivityEtfBalance();

    // Now switch to month mode starting at month 1 - i.e. effectively no gate at
    // all. The abandoned 90% threshold must no longer apply.
    await user.click(screen.getByRole('radio', { name: /After a set number of months/ }));
    setField('Start from month', 1);

    expect(sensitivityEtfBalance()).not.toBe(gatedByThreshold);
  });

  it('the same is true for the Strategy Comparison panel', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfControls(user);
    setField('ETF Allocation', 50);

    const readScenarioEtf = () => {
      const table = screen.getByText(/^Outcome at three assumed ETF returns$/).closest('table');
      return table.textContent;
    };

    await user.click(screen.getByRole('radio', { name: /reaches a share of the loan/ }));
    setField('Switch Trigger', 90);
    const gated = readScenarioEtf();

    await user.click(screen.getByRole('radio', { name: /After a set number of months/ }));
    setField('Start from month', 1);

    expect(readScenarioEtf()).not.toBe(gated);
  });

  it('labels the Pareto grid as exploring the loan-% criterion', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfControls(user);
    setField('ETF Allocation', 50);

    expect(screen.getByText(/explores the "% of the loan" criterion/i)).toBeInTheDocument();
  });

  it('warns that applying a grid row will switch criteria, only when not already on it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfControls(user);
    setField('ETF Allocation', 50);

    // Default is "right away", so applying a row would change the criterion.
    expect(screen.getByText(/will switch you to that criterion/i)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /reaches a share of the loan/ }));
    expect(screen.queryByText(/will switch you to that criterion/i)).not.toBeInTheDocument();
  });
});
