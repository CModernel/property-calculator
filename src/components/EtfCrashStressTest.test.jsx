// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EtfCrashStressTest from './EtfCrashStressTest';

// Plain summary objects, the shape summariseStrategy returns - only the four
// fields this component reads.
const summary = (key, label, etf, netWorth) => ({ key, label, etf, netWorth });

const SUMMARIES = [
  summary('noCrash', 'No crash', 200000, 750000),
  summary('crash20', '-20%', 160000, 710000),
  summary('crash30', '-30%', 140000, 690000),
  summary('crash40', '-40%', 120000, 670000),
];

describe('EtfCrashStressTest', () => {
  it('renders the no-crash baseline plus one column per severity', () => {
    render(<EtfCrashStressTest summaries={SUMMARIES} crashMonth={60} />);
    for (const label of ['No crash', '-20%', '-30%', '-40%']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('shows each severity\'s ETF balance and net worth', () => {
    render(<EtfCrashStressTest summaries={SUMMARIES} crashMonth={60} />);
    expect(screen.getByText('$160,000')).toBeInTheDocument();
    expect(screen.getByText('$690,000')).toBeInTheDocument();
  });

  it('shows the net-worth gap against the no-crash baseline, in red for a loss', () => {
    render(<EtfCrashStressTest summaries={SUMMARIES} crashMonth={60} />);
    // 710,000 - 750,000 = -40,000
    expect(screen.getByText('-$40,000')).toHaveClass('text-red-600');
    expect(screen.getByText('-$80,000')).toHaveClass('text-red-600');
  });

  it('leaves the baseline column\'s own gap cell empty rather than showing +$0', () => {
    render(<EtfCrashStressTest summaries={SUMMARIES} crashMonth={60} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('+$0')).not.toBeInTheDocument();
  });

  it('colours a positive gap green, on the off chance a crash leaves you ahead', () => {
    const odd = [SUMMARIES[0], summary('crash20', '-20%', 160000, 760000)];
    render(<EtfCrashStressTest summaries={odd} crashMonth={60} />);
    expect(screen.getByText('+$10,000')).toHaveClass('text-green-600');
  });

  // The feature's central honest finding - must always be present, not
  // conditional on the numbers.
  it('always states that payoff time and total interest are unaffected, and why', () => {
    render(<EtfCrashStressTest summaries={SUMMARIES} crashMonth={60} />);
    expect(screen.getByText(/identical in every column/)).toBeInTheDocument();
    expect(screen.getByText(/never sells ETF units to service the mortgage/)).toBeInTheDocument();
    expect(screen.getByText(/not an emergency buffer/)).toBeInTheDocument();
  });

  // The table's own accessible caption has to name the month, so a screen-reader
  // user knows which scenario the columns describe.
  it('names the crash month in the table caption', () => {
    render(<EtfCrashStressTest summaries={SUMMARIES} crashMonth={36} />);
    expect(screen.getByText(/^Outcome after a one-off ETF market drop at month 36$/)).toBeInTheDocument();
  });
});
