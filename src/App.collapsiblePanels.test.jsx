// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Each case: [button name regex, a stable text/label that only appears once expanded]
const TOGGLE_CASES = [
  ['Income breakdown', () => screen.getByText('💵 Income Sources')],
  ['Personal expenses breakdown', () => screen.getByText('💰 Offset Contributions Schedule')],
  ['Property expenses breakdown', () => screen.getByLabelText('Utilities (monthly)')],
  ['Closing costs breakdown', () => screen.getByLabelText('Conveyancing')],
];

describe.each(TOGGLE_CASES)('input-panel toggle: %s', (buttonNameRegex, getContent) => {
  it('flips the ▸/▾ glyph and reveals/hides its content', async () => {
    const user = userEvent.setup();
    render(<App />);
    const toggle = screen.getByRole('button', { name: new RegExp(buttonNameRegex) });
    expect(toggle).toHaveTextContent('▸');
    expect(() => getContent()).toThrow();

    await user.click(toggle);
    expect(screen.getByRole('button', { name: new RegExp(buttonNameRegex) })).toHaveTextContent('▾');
    expect(getContent()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: new RegExp(buttonNameRegex) }));
    expect(screen.getByRole('button', { name: new RegExp(buttonNameRegex) })).toHaveTextContent('▸');
    expect(() => getContent()).toThrow();
  });
});

describe('results-panel breakdown toggles', () => {
  it('"▸ Property Expenses:" reveals its Strata/Council/... sub-rows', async () => {
    const user = userEvent.setup();
    render(<App />);
    const toggle = screen.getByRole('button', { name: /▸ Property Expenses:/ });
    expect(screen.queryByText('Strata:')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByText('Strata:')).toBeInTheDocument();
  });

  it('"▸ Personal Expenses:" reveals its Food/Transport sub-rows', async () => {
    const user = userEvent.setup();
    render(<App />);
    const toggle = screen.getByRole('button', { name: /▸ Personal Expenses:/ });
    expect(screen.queryByText('Food:')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByText('Food:')).toBeInTheDocument();
  });
});

describe('"Add" form toggles', () => {
  it('Income: "+ Add" reveals the Income Name field; toggling again hides it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Income breakdown/ }));
    const addToggle = screen.getByRole('button', { name: '+ Add' });

    await user.click(addToggle);
    expect(screen.getByText('Income Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '✕ Cancel' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '✕ Cancel' }));
    expect(screen.queryByText('Income Name')).not.toBeInTheDocument();
  });

  it('Offset Contributions: "+ Add" reveals the Amount field', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Personal expenses breakdown/ }));
    const contributionsSection = screen.getByText('💰 Offset Contributions Schedule').parentElement;

    await user.click(within(contributionsSection).getByRole('button', { name: '+ Add' }));
    expect(screen.getByLabelText('Amount ($)')).toBeInTheDocument();
  });

  it('Exceptional Expenses: "+ Add" reveals the Expense Name field', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Personal expenses breakdown/ }));
    const section = screen.getByText('Personal Expenses').parentElement;

    await user.click(within(section).getByRole('button', { name: '+ Add' }));
    expect(screen.getByPlaceholderText(/Food, Transport, Wedding/)).toBeInTheDocument();
  });

  it('Other Expenses: "+ Add" reveals the Expense Name category select', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Personal expenses breakdown/ }));
    const section = screen.getByText('Other Expenses').parentElement;

    await user.click(within(section).getByRole('button', { name: '+ Add' }));
    expect(screen.getByDisplayValue('Health')).toBeInTheDocument();
  });
});

describe('showPersonalExpenses gates all three sub-sections at once', () => {
  it('collapsed hides Offset Contributions/Personal Expenses/Other Expenses simultaneously; expanding reveals all three', () => {
    render(<App />);
    for (const heading of ['💰 Offset Contributions Schedule', 'Personal Expenses', 'Other Expenses']) {
      expect(screen.queryByText(heading)).not.toBeInTheDocument();
    }
    expect(screen.queryByText('Food')).not.toBeInTheDocument();
  });

  it('expanding reveals all three sub-sections together', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Personal expenses breakdown/ }));

    for (const heading of ['💰 Offset Contributions Schedule', 'Personal Expenses', 'Other Expenses']) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
    // Food is a seeded personalExpenseItems list entry now (TODO-66), not a
    // fixed labeled field.
    expect(screen.getByText('Food')).toBeInTheDocument();
  });
});
