// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// TODO-109 consolidated every "Realistic Mode" factor into one dedicated
// card, but its own checkbox and "Invest in ETFs" both nest an InfoTooltip
// INSIDE their <label> (unlike "First Home Buyer", which deliberately keeps
// its tooltip as a sibling after </label> to avoid this exact problem) -
// so the accessible name picked up by getByLabelText/getByRole('checkbox')
// includes the whole tooltip explanation text too. A regex substring match
// is required; an exact string throws "no match."
const REALISTIC_MODE_CHECKBOX = { name: /^Realistic Mode/ };
const INVEST_IN_ETFS_CHECKBOX = { name: /^Invest in ETFs/ };

async function enableRealisticMode(user) {
  await user.click(screen.getByRole('checkbox', REALISTIC_MODE_CHECKBOX));
}

async function expandFinancialPositionAdvanced(user) {
  await user.click(screen.getByRole('button', { name: /Advanced Assumptions/ }));
}

describe('Realistic Mode card', () => {
  it('hides the 7 factor sliders by default and reveals them with their sensible defaults when checked', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByLabelText('Property Growth Rate')).not.toBeInTheDocument();
    expect(screen.getByText(/Off - every growth\/inflation\/tax assumption/)).toBeInTheDocument();

    await enableRealisticMode(user);

    expect(screen.queryByText(/Off - every growth\/inflation\/tax assumption/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Property Growth Rate')).toHaveValue(5);
    expect(screen.getByLabelText('Salary Growth Rate')).toHaveValue(3);
    expect(screen.getByLabelText('Rent Growth Rate')).toHaveValue(3);
    expect(screen.getByLabelText('Vacancy (weeks/year)')).toHaveValue(2);
    expect(screen.getByLabelText('Expense Growth Rate')).toHaveValue(2.5);
    expect(screen.getByLabelText('Inflation Rate')).toHaveValue(2.5);
    expect(screen.getByLabelText('Effective Tax Rate')).toHaveValue(20);
  });

  it('unchecking hides the sliders again (holding effect at 0) without resetting their values', async () => {
    const user = userEvent.setup();
    render(<App />);
    await enableRealisticMode(user);

    fireEvent.change(screen.getByLabelText('Property Growth Rate'), { target: { value: '8' } });
    fireEvent.blur(screen.getByLabelText('Property Growth Rate'));
    expect(screen.getByLabelText('Property Growth Rate')).toHaveValue(8);

    await enableRealisticMode(user); // unchecks it
    expect(screen.queryByLabelText('Property Growth Rate')).not.toBeInTheDocument();
    expect(screen.getByText(/Off - every growth\/inflation\/tax assumption/)).toBeInTheDocument();

    await enableRealisticMode(user); // checks it again
    expect(screen.getByLabelText('Property Growth Rate')).toHaveValue(8);
  });

  it('turning Realistic Mode on changes "Time to pay off" and "Total interest paid" away from the off-state baseline', async () => {
    const user = userEvent.setup();
    render(<App />);

    const timeToPayOffBefore = screen.getByText('Time to pay off:').parentElement.textContent;
    const totalInterestBefore = screen.getByText('Total interest paid:').parentElement.textContent;

    await enableRealisticMode(user);

    const timeToPayOffAfter = screen.getByText('Time to pay off:').parentElement.textContent;
    const totalInterestAfter = screen.getByText('Total interest paid:').parentElement.textContent;

    expect(timeToPayOffAfter).not.toBe(timeToPayOffBefore);
    expect(totalInterestAfter).not.toBe(totalInterestBefore);
  });
});

describe('Invest in ETFs / Strategy Comparison', () => {
  it('disables "Invest in ETFs" while Realistic Mode is off, enables it once Realistic Mode is checked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await expandFinancialPositionAdvanced(user);

    expect(screen.getByRole('checkbox', INVEST_IN_ETFS_CHECKBOX)).toBeDisabled();

    await enableRealisticMode(user);

    expect(screen.getByRole('checkbox', INVEST_IN_ETFS_CHECKBOX)).toBeEnabled();
  });

  it('reveals the Strategy Comparison table once Invest in ETFs is checked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await enableRealisticMode(user);
    await expandFinancialPositionAdvanced(user);

    expect(screen.queryByText('🔍 Strategy Comparison')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', INVEST_IN_ETFS_CHECKBOX));

    expect(screen.getByText('🔍 Strategy Comparison')).toBeInTheDocument();
    // "ETF Balance" is skipped here - it nests its own InfoTooltip inside the
    // <th>, same accessible-name gotcha as the checkboxes above.
    for (const header of ['Switch', 'Allocation', 'Interest Paid', 'Risk', 'Crash Test']) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button', { name: /^(Apply|Applied)$/ }).length).toBeGreaterThan(0);
  });

  it('clicking Apply on a table row updates the ETF Allocation and Switch Trigger sliders to match that row', async () => {
    const user = userEvent.setup();
    render(<App />);
    await enableRealisticMode(user);
    await expandFinancialPositionAdvanced(user);
    await user.click(screen.getByRole('checkbox', INVEST_IN_ETFS_CHECKBOX));

    // getByRole('table') alone is ambiguous - LvrBadge's tooltip also
    // renders a (visually hidden but DOM-present) <table> everywhere on the
    // page. Scope to the Strategy Comparison section specifically.
    const strategySection = screen.getByText('🔍 Strategy Comparison').closest('div');
    const rows = within(strategySection).getAllByRole('row').slice(1); // skip header row
    // Pick a row with a non-zero Allocation (not the baseline anchor row), so
    // the sliders visibly move away from their own defaults.
    const targetRow = rows.find((row) => within(row).getAllByRole('cell')[1].textContent !== '0%');
    expect(targetRow).toBeDefined();
    const expectedSwitch = Number(within(targetRow).getAllByRole('cell')[0].textContent.replace('%', ''));
    const expectedAllocation = Number(within(targetRow).getAllByRole('cell')[1].textContent.replace('%', ''));

    await user.click(within(targetRow).getByRole('button', { name: 'Apply' }));

    expect(screen.getByLabelText('Switch Trigger')).toHaveValue(expectedSwitch);
    expect(screen.getByLabelText('ETF Allocation')).toHaveValue(expectedAllocation);
  });
});
