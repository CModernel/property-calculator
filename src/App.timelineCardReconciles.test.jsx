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
// gated on whether the interest actually came down instead. Since TODO-173 the
// surplus only saves interest from month 2, so on the default (no month-1
// contribution) month-1 interest is the full figure and there is no tag.
describe('"(offset applied)" next to month-1 interest (TODO-172/173)', () => {
  it('is absent on the default, where month 1 has no contribution', () => {
    render(<App />);
    expect(screen.queryByText('(offset applied)')).not.toBeInTheDocument();
  });

  it('shows once a month-1 contribution reduces month-1 interest', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Offset contributions breakdown/ }));
    const section = screen.getByText('💰 Offset Contributions Schedule').parentElement;
    await user.click(within(section).getByRole('button', { name: '+ Add' }));
    // The all-defaults form is one $10,000 one-time contribution at month 1.
    await user.click(screen.getByRole('button', { name: 'Add Contribution' }));
    expect(screen.getByText('(offset applied)')).toBeInTheDocument();
  });
});

describe('Offset-vs-ETF timing disclosure (TODO-173)', () => {
  it('states the shared deposit convention in the comparison tooltip', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('checkbox', { name: /^Show ETF investing options/ }));
    await user.click(screen.getByRole('button', { name: /ETF settings and strategy comparison/ }));
    const button = screen.getByLabelText('What is this comparing?');
    const tooltip = button.parentElement.querySelector('[role="tooltip"]');
    expect(tooltip.textContent).toMatch(/starts working the following month/);
    expect(tooltip.textContent).toMatch(/in the offset and the ETF alike/);
  });
});
