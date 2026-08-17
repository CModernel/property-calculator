// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { serializeScenarioPayload } from './persistence/scenarioStorage';

// TODO-135: the Simple/Advanced gate. The load-bearing property is that it is
// PRESENTATION ONLY - switching modes must not change a single figure.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

const toSimple = (user) => user.click(screen.getByRole('button', { name: /Simple mode/ }));
const toAdvanced = (user) => user.click(screen.getByRole('button', { name: /Advanced mode/ }));

describe('Simple / Advanced UI mode (TODO-135)', () => {
  it('defaults to Advanced - today\'s full interface, nothing lost', () => {
    render(<App />);
    expect(screen.getByText('Purchase Details')).toBeInTheDocument();
    expect(screen.getByText('Timeline Explorer')).toBeInTheDocument();
    expect(screen.getByText('Extra Investments & Strategies')).toBeInTheDocument();
    // The toggle offers the OTHER mode, so in Advanced it reads "Simple mode".
    expect(screen.getByRole('button', { name: /Simple mode/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switching to Simple hides the Advanced-only cards but keeps the core inputs editable', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toSimple(user);

    expect(screen.queryByText('Timeline Explorer')).not.toBeInTheDocument();
    expect(screen.queryByText('Extra Investments & Strategies')).not.toBeInTheDocument();
    expect(screen.queryByText('Offset Contributions')).not.toBeInTheDocument();
    expect(screen.queryByText('Projection Assumptions')).not.toBeInTheDocument();

    for (const label of ['Property Price', 'Deposit Contribution', 'Loan Amount', 'Interest Rate', 'Loan Term', 'Available Savings']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('switching back to Advanced restores everything', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toSimple(user);
    expect(screen.queryByText('Timeline Explorer')).not.toBeInTheDocument();

    await toAdvanced(user);
    expect(screen.getByText('Timeline Explorer')).toBeInTheDocument();
    expect(screen.getByText('Purchase Details')).toBeInTheDocument();
  });

  // THE test for this feature: the same scenario must read identically in both
  // modes. If a figure differs, the gate has leaked into the model.
  it('shows the same figures in both modes for the same scenario', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Advanced: read Repayments and Total Cash Required from their own panels.
    const advancedRepayment = screen.getByText(/^Repayments: \$/).textContent;
    const advancedCashRequired = screen.getByText('Total Cash Required:').parentElement.textContent;
    const repaymentFigure = advancedRepayment.match(/\$[\d,]+/)[0];
    const cashRequiredFigure = advancedCashRequired.match(/\$[\d,]+/)[0];

    await toSimple(user);

    // Simple presents them differently but the numbers must be the same.
    expect(screen.getByLabelText('Loan Term')).toBeInTheDocument(); // sanity: we're in Simple
    const simpleBody = document.body.textContent;
    expect(simpleBody).toContain(repaymentFigure);
    expect(simpleBody).toContain(cashRequiredFigure);
  });

  it('the mode persists across a remount, independently of the scenario', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await toSimple(user);
    first.unmount();

    render(<App />);
    expect(screen.getByRole('button', { name: /Advanced mode/ })).toBeInTheDocument();
    expect(screen.queryByText('Timeline Explorer')).not.toBeInTheDocument();
  });

  // TODO-135 item 4: loading a scenario must not change interface complexity.
  it('loading a saved scenario does not change the mode', () => {
    localStorage.setItem('propertyCalculator.uiMode', 'simple');
    localStorage.setItem('propertyCalculator.scenario', serializeScenarioPayload({ propertyPrice: 1200000 }));

    render(<App />);
    // Still Simple, even though a scenario was just loaded.
    expect(screen.getByRole('button', { name: /Advanced mode/ })).toBeInTheDocument();
    expect(screen.queryByText('Timeline Explorer')).not.toBeInTheDocument();
  });

  it('Simple mode discloses that hidden editors still count, and links back to Advanced', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toSimple(user);

    expect(screen.getByText(/Included in these figures, editable in Advanced/)).toBeInTheDocument();
    // config.default.json seeds 1 income source and 3 personal expenses.
    expect(screen.getByText('1 income source')).toBeInTheDocument();
    expect(screen.getByText('3 personal expenses')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /View details in Advanced/ }));
    expect(screen.getByText('Timeline Explorer')).toBeInTheDocument();
  });

  it('Simple mode shows only the three-indicator Health Check subset', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toSimple(user);

    const card = screen.getByText(/Can you sustain it\?/).closest('div');
    expect(within(card).getByText('Housing Cost Ratio')).toBeInTheDocument();
    expect(within(card).getByText('Interest Rate Stress Test')).toBeInTheDocument();
    expect(within(card).getByText('Emergency Buffer')).toBeInTheDocument();
    expect(screen.queryByText('Upfront Cost Ratio')).not.toBeInTheDocument();
  });
});
