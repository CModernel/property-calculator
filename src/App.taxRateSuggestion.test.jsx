// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// TODO-122: the Effective Tax Rate slider gains a suggestion derived from real
// ATO brackets and the user's own Gross-marked income. The slider stays the only
// thing the simulation reads - the suggestion only ever writes to it via the
// user clicking "Use this rate".

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

async function openProjectionAssumptions(user) {
  await user.click(screen.getByRole('button', { name: /Projection assumptions/ }));
}

// Adds a Gross-marked Salary/Wages source at the given weekly amount. The
// shipped default income item is NOT gross-marked, so this is what turns the
// suggestion on.
async function addGrossSalary(user, weeklyAmount) {
  await user.click(screen.getByRole('button', { name: /Income breakdown/ }));
  await user.click(screen.getByRole('button', { name: '+ Add' }));
  fireEvent.change(screen.getByLabelText('Weekly Amount ($)'), { target: { value: String(weeklyAmount) } });
  fireEvent.blur(screen.getByLabelText('Weekly Amount ($)'));
  await user.click(screen.getByLabelText(/This is a gross \(pre-tax\) amount/));
  await user.click(screen.getByRole('button', { name: 'Add Income' }));
}

describe('Effective Tax Rate suggestion (TODO-122)', () => {
  it('explains why there is no suggestion when no income is marked Gross', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openProjectionAssumptions(user);

    expect(screen.getByText(/No income source is marked "Gross \(pre-tax\)"/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use this rate' })).not.toBeInTheDocument();
  });

  it('always carries the not-tax-advice disclaimer, suggestion or not', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openProjectionAssumptions(user);
    expect(screen.getByText(/not tax advice/)).toBeInTheDocument();
  });

  it('shows the suggested rate and the income it came from once income is Gross-marked', async () => {
    const user = userEvent.setup();
    render(<App />);
    // $2,500/wk = $130,000/yr -> tax 4,020 + 30% x 85,000 = 29,520, plus 2%
    // Medicare 2,600 => 32,120 / 130,000 = 24.7% -> 25%.
    await addGrossSalary(user, 2500);
    await openProjectionAssumptions(user);

    expect(screen.getByText(/~25%/)).toBeInTheDocument();
    expect(screen.getByText(/\$130,000\/year of Gross-marked income/)).toBeInTheDocument();
  });

  it('"Use this rate" moves the slider to the suggestion, then the button gives way to a match note', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addGrossSalary(user, 2500);
    await openProjectionAssumptions(user);

    // The slider starts at the shipped 20% default, not the suggestion - nothing
    // is auto-applied.
    expect(screen.getByLabelText('Effective Tax Rate')).toHaveValue(20);

    await user.click(screen.getByRole('button', { name: 'Use this rate' }));

    expect(screen.getByLabelText('Effective Tax Rate')).toHaveValue(25);
    expect(screen.queryByRole('button', { name: 'Use this rate' })).not.toBeInTheDocument();
    expect(screen.getByText('That matches your current rate.')).toBeInTheDocument();
  });

  it('recalculates live when income changes, without touching the slider', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addGrossSalary(user, 2500);
    await openProjectionAssumptions(user);
    await user.click(screen.getByRole('button', { name: 'Use this rate' }));
    expect(screen.getByLabelText('Effective Tax Rate')).toHaveValue(25);

    // Removing the gross income drops the suggestion back to its empty state.
    // The rate the user accepted must stay exactly where it was.
    const incomeRows = screen.getAllByRole('button', { name: '✕' });
    await user.click(incomeRows[incomeRows.length - 1]);

    expect(screen.getByText(/No income source is marked "Gross \(pre-tax\)"/)).toBeInTheDocument();
    expect(screen.getByLabelText('Effective Tax Rate')).toHaveValue(25);
  });

  it('offers a real 0% suggestion for income under the tax-free threshold', async () => {
    const user = userEvent.setup();
    render(<App />);
    // $300/wk = $15,600/yr, below the $18,200 tax-free threshold.
    await addGrossSalary(user, 300);
    await openProjectionAssumptions(user);

    expect(screen.getByText(/~0%/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use this rate' })).toBeInTheDocument();
  });
});
