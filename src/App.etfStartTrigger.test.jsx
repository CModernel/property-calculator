// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// TODO-144: one "Start ETF investing when" selector replaces what would
// otherwise be three overlapping gates. The engine ANDs all three criteria with
// no-op defaults; the UI guarantees only one is ever non-default.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

// The ETF controls sit behind a master checkbox plus a collapse.
async function openEtfControls(user) {
  await user.click(screen.getByRole('checkbox', { name: /^Show ETF investing options/ }));
  await user.click(screen.getByRole('button', { name: /ETF settings and strategy comparison/ }));
  await user.click(screen.getByRole('checkbox', { name: /^Invest in ETFs/ }));
}

describe('ETF start trigger selector (TODO-144)', () => {
  it('defaults to "Right away", matching the pre-existing behaviour', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfControls(user);

    expect(screen.getByRole('radio', { name: 'Right away' })).toBeChecked();
    // None of the three criterion editors is showing while immediate is picked.
    expect(screen.queryByLabelText('Start from month')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Switch Trigger')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reserve first')).not.toBeInTheDocument();
  });

  it('reveals only the selected criterion\'s editor, one at a time', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfControls(user);

    await user.click(screen.getByRole('radio', { name: /After a set number of months/ }));
    expect(screen.getByLabelText('Start from month')).toBeInTheDocument();
    expect(screen.queryByLabelText('Switch Trigger')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reserve first')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /reaches a share of the loan/ }));
    expect(screen.getByLabelText('Switch Trigger')).toBeInTheDocument();
    expect(screen.queryByLabelText('Start from month')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /covers a few months of expenses/ }));
    expect(screen.getByLabelText('Reserve first')).toBeInTheDocument();
    expect(screen.queryByLabelText('Switch Trigger')).not.toBeInTheDocument();
  });

  // The point of the single selector: a value left behind on a criterion the
  // user has since switched away from must not keep gating the simulation.
  it('switching criteria stops the previous one from affecting the result', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfControls(user);

    // Set a delayed start, then switch away from it.
    await user.click(screen.getByRole('radio', { name: /After a set number of months/ }));
    const monthInput = screen.getByLabelText('Start from month');
    fireChange(monthInput, '60');
    const withDelay = readPayoffTime();

    await user.click(screen.getByRole('radio', { name: 'Right away' }));
    const immediate = readPayoffTime();

    // The stale 60-month delay is no longer applied, so the result differs.
    expect(withDelay).not.toBe(immediate);
  });

  // The regression this feature introduced and had to fix: the Strategy
  // Comparison grid varies the loan-ratio threshold, so applying a row has to
  // select that criterion too or the applied value never reaches the engine.
  it('applying a Strategy Comparison row also selects the loan-ratio criterion', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfControls(user);
    await user.click(screen.getByRole('radio', { name: /After a set number of months/ }));

    const applyButtons = screen.getAllByRole('button', { name: 'Apply' });
    await user.click(applyButtons[applyButtons.length - 1]);

    expect(screen.getByRole('radio', { name: /reaches a share of the loan/ })).toBeChecked();
    expect(screen.getByLabelText('Switch Trigger')).toBeInTheDocument();
  });
});

// Helpers kept below the describe for readability.
function fireChange(input, value) {
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

function readPayoffTime() {
  return screen.getByText('Time to pay off:').parentElement.textContent;
}
