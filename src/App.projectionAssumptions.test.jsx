// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// "Invest in ETFs" and the ETF master toggle both nest an InfoTooltip INSIDE
// their <label> (unlike "First Home Buyer", which deliberately keeps its
// tooltip as a sibling after </label> to avoid this exact problem) - so the
// accessible name picked up by getByLabelText/getByRole('checkbox') includes
// the whole tooltip explanation text too. A regex substring match is
// required; an exact string throws "no match."
const SHOW_ETF_OPTIONS_CHECKBOX = { name: /^Show ETF investing options/ };
const INVEST_IN_ETFS_CHECKBOX = { name: /^Invest in ETFs/ };

// TODO-141: the card ships collapsed (matching every other input card), so
// reaching any assumption slider means expanding it first. This only affects
// visibility - the assumptions themselves are always applied.
async function expandProjectionAssumptions(user) {
  await user.click(screen.getByRole('button', { name: /Projection assumptions/ }));
}

// TODO-137: the ETF family moved out of Financial Position's Advanced
// Assumptions into its own "Extra Investments & Strategies" card. Two
// separate steps on purpose: the checkbox is an opt-in that pauses the
// simulation effect, the expander is presentation only.
async function enableEtfOptions(user) {
  await user.click(screen.getByRole('checkbox', SHOW_ETF_OPTIONS_CHECKBOX));
}

async function expandEtfSection(user) {
  await user.click(screen.getByRole('button', { name: /ETF settings and strategy comparison/ }));
}

// Enabling the master toggle reveals the expander, which then has to be
// opened before any ETF control is reachable.
async function openEtfSection(user) {
  await enableEtfOptions(user);
  await expandEtfSection(user);
}

function readResults() {
  return {
    timeToPayOff: screen.getByText('Time to pay off:').parentElement.textContent,
    totalInterest: screen.getByText('Total interest paid:').parentElement.textContent,
  };
}

describe('Projection Assumptions card (TODO-141)', () => {
  it('starts collapsed and reveals the 7 assumption sliders at their documented defaults', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByLabelText('Property Growth Rate')).not.toBeInTheDocument();

    await expandProjectionAssumptions(user);

    expect(screen.getByLabelText('Property Growth Rate')).toHaveValue(5);
    expect(screen.getByLabelText('Salary Growth Rate')).toHaveValue(3);
    expect(screen.getByLabelText('Rent Growth Rate')).toHaveValue(3);
    expect(screen.getByLabelText('Vacancy (weeks/year)')).toHaveValue(2);
    expect(screen.getByLabelText('Expense Growth Rate')).toHaveValue(2.5);
    expect(screen.getByLabelText('Inflation Rate')).toHaveValue(2.5);
    expect(screen.getByLabelText('Effective Tax Rate')).toHaveValue(20);
  });

  // The core promise of TODO-141: a UI control may change what is VISIBLE, it
  // may never change the financial model. Expanding/collapsing the card must
  // leave every result byte-identical.
  it('expanding or collapsing the card does not change any result', async () => {
    const user = userEvent.setup();
    render(<App />);

    const whileCollapsed = readResults();

    await expandProjectionAssumptions(user);
    expect(readResults()).toEqual(whileCollapsed);

    await expandProjectionAssumptions(user); // collapse again
    expect(readResults()).toEqual(whileCollapsed);
  });

  it('changing an assumption does change the results', async () => {
    const user = userEvent.setup();
    render(<App />);
    await expandProjectionAssumptions(user);

    const before = readResults();

    fireEvent.change(screen.getByLabelText('Expense Growth Rate'), { target: { value: '10' } });
    fireEvent.blur(screen.getByLabelText('Expense Growth Rate'));

    const after = readResults();
    expect(after.timeToPayOff).not.toBe(before.timeToPayOff);
    expect(after.totalInterest).not.toBe(before.totalInterest);
  });

  // Replaces the old "Realistic Mode is off" banner: a flat baseline is now a
  // real state the user can choose, and it has to say so about itself.
  it('labels the projection as a flat baseline only once every simulation-affecting assumption is 0', async () => {
    const user = userEvent.setup();
    render(<App />);
    await expandProjectionAssumptions(user);

    expect(screen.queryByText(/these figures are a flat baseline/)).not.toBeInTheDocument();

    for (const label of ['Salary Growth Rate', 'Rent Growth Rate', 'Expense Growth Rate', 'Vacancy (weeks/year)', 'Effective Tax Rate']) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: '0' } });
      fireEvent.blur(screen.getByLabelText(label));
    }

    expect(screen.getByText(/these figures are a flat baseline/)).toBeInTheDocument();
  });
});

describe('Invest in ETFs / Strategy Comparison', () => {
  it('hides ETF controls by default and restores the child settings when re-enabled', async () => {
    const user = userEvent.setup();
    render(<App />);

    const masterToggle = screen.getByRole('checkbox', SHOW_ETF_OPTIONS_CHECKBOX);
    expect(masterToggle).not.toBeChecked();
    expect(screen.queryByRole('checkbox', INVEST_IN_ETFS_CHECKBOX)).not.toBeInTheDocument();

    await openEtfSection(user);
    await user.click(screen.getByRole('checkbox', INVEST_IN_ETFS_CHECKBOX));
    expect(screen.getByLabelText('ETF Allocation')).toBeInTheDocument();
    expect(screen.getByText(/📈 ETF:/)).toBeInTheDocument();

    await user.click(masterToggle);
    expect(screen.queryByRole('checkbox', INVEST_IN_ETFS_CHECKBOX)).not.toBeInTheDocument();
    expect(screen.queryByText(/📈 ETF:/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('ETF Allocation')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', SHOW_ETF_OPTIONS_CHECKBOX));
    expect(screen.getByRole('checkbox', INVEST_IN_ETFS_CHECKBOX)).toBeChecked();
    expect(screen.getByLabelText('ETF Allocation')).toBeInTheDocument();
  });

  // TODO-141: the gate is now the tax rate itself, not a mode that forced it
  // to 0. Comparing a pre-tax ETF return against the offset's tax-free return
  // is dishonest whatever put the rate at 0, so the condition survives.
  it('disables "Invest in ETFs" only while Effective Tax Rate is 0', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfSection(user);

    expect(screen.getByRole('checkbox', INVEST_IN_ETFS_CHECKBOX)).toBeEnabled();

    await expandProjectionAssumptions(user);
    fireEvent.change(screen.getByLabelText('Effective Tax Rate'), { target: { value: '0' } });
    fireEvent.blur(screen.getByLabelText('Effective Tax Rate'));

    expect(screen.getByRole('checkbox', INVEST_IN_ETFS_CHECKBOX)).toBeDisabled();
  });

  it('reveals the Strategy Comparison table once Invest in ETFs is checked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfSection(user);

    expect(screen.queryByText('🔍 Strategy Comparison')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', INVEST_IN_ETFS_CHECKBOX));

    expect(screen.getByText('🔍 Strategy Comparison')).toBeInTheDocument();
    // "ETF Balance" is skipped here - it nests its own InfoTooltip inside the
    // <th>, same accessible-name gotcha as the checkboxes above.
    for (const header of ['Switch', 'Allocation', 'Interest Paid', 'Risk', 'Crash Test', 'Cash Shortfall']) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button', { name: /^(Apply|Applied)$/ }).length).toBeGreaterThan(0);
  });

  // TODO-143: the default scenario has no deficit month anywhere, so every
  // Pareto row should read "None" - the red-flagged path is covered precisely
  // at the calculation layer (strategyComparison.test.js), this just proves
  // the column is wired up and defaults to the honest, unflagged reading.
  it('shows no cash shortfall flag for a scenario with no deficit months', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfSection(user);
    await user.click(screen.getByRole('checkbox', INVEST_IN_ETFS_CHECKBOX));

    const strategySection = screen.getByText('🔍 Strategy Comparison').closest('div');
    expect(screen.queryByText(/⚠️.*over.*mo/)).not.toBeInTheDocument();
    expect(within(strategySection).getAllByText('None').length).toBeGreaterThan(0);
  });

  it('clicking Apply on a table row updates the ETF Allocation and Switch Trigger sliders to match that row', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfSection(user);
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

// TODO-137: the side-by-side panel, distinct from the Pareto search above it.
describe('Offset vs ETF side-by-side comparison', () => {
  const COMPARISON_HEADING = '⚖️ Offset vs ETF, side by side';

  async function openComparison(user) {
    await openEtfSection(user);
    await user.click(screen.getByRole('checkbox', INVEST_IN_ETFS_CHECKBOX));
  }

  function comparisonSection() {
    return screen.getByText(COMPARISON_HEADING).closest('div').parentElement;
  }

  it('appears only once ETF investing is actually on', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openEtfSection(user);
    expect(screen.queryByText(COMPARISON_HEADING)).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', INVEST_IN_ETFS_CHECKBOX));
    expect(screen.getByText(COMPARISON_HEADING)).toBeInTheDocument();
  });

  it('names all three strategies and labels the custom one with its own allocation', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openComparison(user);

    const section = comparisonSection();
    expect(within(section).getAllByText('Offset only').length).toBeGreaterThan(0);
    expect(within(section).getAllByText('All to ETF').length).toBeGreaterThan(0);
    // The default allocation is 20%, rendered alongside the "Your split" label.
    expect(within(section).getAllByText(/\(20% ETF\)/).length).toBeGreaterThan(0);
  });

  it('switching the tracked metric re-renders the over-time table', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openComparison(user);

    const selector = screen.getByLabelText('Track over time:');
    expect(selector).toHaveValue('netWorth');

    await user.selectOptions(selector, 'etf');
    expect(selector).toHaveValue('etf');
    // Offset-only never invests, so its column is $0 in every row.
    const section = comparisonSection();
    expect(within(section).getAllByText('$0').length).toBeGreaterThan(0);
  });

  // The panel and the Timeline Explorer read the same simulation through the
  // same helpers; if they ever diverge, one of them is lying to the user.
  it('agrees with the Timeline Explorer on the final offset balance for the chosen split', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openComparison(user);

    await user.selectOptions(screen.getByLabelText('Track over time:'), 'offset');
    const section = comparisonSection();
    const bodyRows = within(section).getAllByRole('row');
    const lastRow = bodyRows[bodyRows.length - 1];
    // Columns are [month, Offset only, Your split, All to ETF].
    const yourSplitFinal = within(lastRow).getAllByRole('cell')[2].textContent;

    // Drive the Timeline Explorer to its own final month and compare.
    const monthSlider = screen.getByLabelText('Viewing month');
    fireEvent.change(monthSlider, { target: { value: monthSlider.max } });
    expect(screen.getByText(new RegExp(`💰 Offset: \\${yourSplitFinal}`))).toBeInTheDocument();
  });
});
