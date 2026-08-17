// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// TODO-139: guards the two real bug fixes (Vacancy, Effective Tax Rate were
// wrongly colored before this change) and one deliberate exclusion (Property
// Growth Rate never touches total interest/payoff time/cash remaining, so it
// keeps no impact coloring), so a future edit can't silently revert them.

async function openProjectionAssumptions(user) {
  await user.click(screen.getByRole('button', { name: /Projection assumptions/ }));
}

describe('Slider impact colors (TODO-139)', () => {
  it('Vacancy is negative, not the positive it used to be wrongly colored', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openProjectionAssumptions(user);

    const slider = screen.getByLabelText('Vacancy (weeks/year) slider (higher increases cost)');
    expect(slider).toHaveClass('bg-orange-200', 'dark:bg-orange-900');
  });

  it('Effective Tax Rate is negative, reclassified from its old neutral purple', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openProjectionAssumptions(user);

    const slider = screen.getByLabelText('Effective Tax Rate slider (higher increases cost)');
    expect(slider).toHaveClass('bg-orange-200', 'dark:bg-orange-900');
  });

  it('Property Growth Rate is deliberately excluded - no impact icon, no aria-label hint', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openProjectionAssumptions(user);

    expect(screen.getByLabelText('Property Growth Rate slider')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Property Growth Rate slider \(/)).not.toBeInTheDocument();
  });

  it('Property Price is negative and Deposit Contribution is positive', () => {
    render(<App />);
    expect(screen.getByLabelText('Property Price slider (higher increases cost)')).toHaveClass('bg-orange-200');
    expect(screen.getByLabelText('Deposit Contribution slider (higher improves your position)')).toHaveClass('bg-green-200');
  });

  it('Loan Term is neutral', () => {
    render(<App />);
    expect(screen.getByLabelText('Loan Term slider (mixed or no clear financial effect)')).toHaveClass('bg-violet-200');
  });

  it('the legend explaining the color scheme is present on the page', () => {
    render(<App />);
    expect(screen.getByText('Costs you more')).toBeInTheDocument();
    expect(screen.getByText('Helps you')).toBeInTheDocument();
    expect(screen.getByText('Mixed / depends')).toBeInTheDocument();
  });
});
