// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// TODO-172: the Timeline Explorer's "Net Effective Balance" card showed the
// pre-payment interest base next to the post-payment loan, so net never
// equalled loan - offset (off by that month's principal payment, every month).

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

const dollars = (text) => Number(text.replace(/[^0-9]/g, ''));

describe('Timeline Explorer Net Effective Balance card (TODO-172)', () => {
  it.each(['1', '24', '60'])('reconciles net = loan - offset at month %s', (month) => {
    render(<App />);
    // A mid-loan month on purpose: at the payoff month everything is $0 and
    // this would pass without the fix.
    fireEvent.change(screen.getByLabelText('Viewing month'), { target: { value: month } });

    const card = screen.getByText('Net Effective Balance').parentElement;
    const net = dollars(card.querySelector('p.text-4xl').textContent);
    const loan = dollars(screen.getByText(/^🏦 Loan: \$/).textContent);
    const offset = dollars(screen.getByText(/^💰 Offset: \$/).textContent);

    expect(loan).toBeGreaterThan(0);
    expect(offset).toBeGreaterThan(0);
    expect(net).toBe(loan - offset);
  });
});

// Review follow-up: the "(offset applied)" tag next to month-1 interest used to
// be gated on the row's `offset`, which is now end-of-month cash - so it is
// gated on whether the interest actually came down instead.
describe('"(offset applied)" next to month-1 interest (TODO-172)', () => {
  it('shows when the offset reduced month-1 interest', () => {
    render(<App />);
    expect(screen.getByText('(offset applied)')).toBeInTheDocument();
  });

  it('hides when there is no projection to reduce it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Income breakdown/ }));
    const row = screen.getByText('Salary/Wages').closest('div').parentElement;
    await user.click(within(row).getByRole('button', { name: '✕' }));
    expect(screen.queryByText('(offset applied)')).not.toBeInTheDocument();
  });
});
