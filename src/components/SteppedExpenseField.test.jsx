// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SteppedExpenseField from './SteppedExpenseField';

function makeField(overrides = {}) {
  return {
    base: 200,
    setBase: vi.fn(),
    changes: [],
    addChange: vi.fn(),
    removeChange: vi.fn(),
    ...overrides,
  };
}

describe('SteppedExpenseField', () => {
  it('toggles the add-change form open and closed', () => {
    const field = makeField();
    render(<SteppedExpenseField field={field} label="Council Rates" min={0} max={1000} />);

    expect(screen.queryByText('New amount')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('+ Schedule a change'));
    expect(screen.getByText('New amount')).toBeInTheDocument();
    fireEvent.click(screen.getByText('✕ Cancel'));
    expect(screen.queryByText('New amount')).not.toBeInTheDocument();
  });

  it('submitting "Add scheduled change" calls addChange with the entered amount/month, then collapses and resets the form', () => {
    const field = makeField();
    render(<SteppedExpenseField field={field} label="Council Rates" min={0} max={1000} />);

    fireEvent.click(screen.getByText('+ Schedule a change'));
    // The "New amount" label has no `for`/id association in the component
    // itself, so target it by position: index 0 is the main field's own
    // number input, index 1 is this new-amount input.
    const amountInput = screen.getAllByRole('spinbutton')[1];
    fireEvent.change(amountInput, { target: { value: '600' } });
    fireEvent.click(screen.getByText('Add scheduled change'));

    expect(field.addChange).toHaveBeenCalledWith(600, 1);
    expect(screen.queryByText('New amount')).not.toBeInTheDocument();
  });

  it('renders the changes list sorted by startMonth regardless of insertion order', () => {
    const field = makeField({
      changes: [
        { id: 2, amount: 800, startMonth: 13 },
        { id: 1, amount: 600, startMonth: 3 },
      ],
    });
    render(<SteppedExpenseField field={field} label="Council Rates" min={0} max={1000} />);

    const rows = screen.getAllByText(/from month/);
    expect(rows.map((r) => r.textContent)).toEqual(['600 from month 3', '800 from month 13']);
  });

  it('clicking a change\'s ✕ calls removeChange with the correct id', () => {
    const field = makeField({
      changes: [{ id: 42, amount: 600, startMonth: 3 }],
    });
    render(<SteppedExpenseField field={field} label="Council Rates" min={0} max={1000} />);

    fireEvent.click(screen.getByText('✕'));
    expect(field.removeChange).toHaveBeenCalledWith(42);
  });
});
