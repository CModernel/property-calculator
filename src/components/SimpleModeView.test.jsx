// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SimpleModeView from './SimpleModeView';

const GREEN = { label: 'Good', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: '' };

// Mirrors useSteppedValue's return shape, same fake-object approach as
// SteppedExpenseField.test.jsx.
const makeSteppedField = () => ({
  base: 6.13, setBase: vi.fn(), changes: [], addChange: vi.fn(), removeChange: vi.fn(),
});

function makeProps(overrides = {}) {
  return {
    propertyPrice: 850000, onPropertyPriceChange: vi.fn(),
    downPayment: 307000, onDownPaymentChange: vi.fn(),
    loanAmount: 543000, onLoanAmountChange: vi.fn(),
    totalSavings: 350000, onTotalSavingsChange: vi.fn(),
    interestRateField: makeSteppedField(),
    loanTermYears: 30, onLoanTermYearsChange: vi.fn(),
    lvr: 63.9,
    affordability: {
      label: 'Funded', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400',
      headline: 'Settlement and monthly costs are covered.', bindingConstraint: null,
    },
    monthlyPayment: 3301,
    totalCashRequired: 321547,
    cashRemaining: 28453,
    monthlyNetBalance: 2470,
    monthlyIncome: 6994,
    monthlyRentalIncome: 0,
    totalPropertyCost: 3844,
    monthlyPersonalExpenses: 680,
    housingCostRatio: 55, housingCostRatioClass: GREEN,
    stressTestSurvivedDelta: 3, stressTestClass: GREEN,
    emergencyBufferMonths: 6.3, emergencyBufferClass: GREEN,
    incomeSourceCount: 1,
    personalExpenseCount: 3,
    offsetContributionCount: 0,
    activeAdvancedFeatures: [],
    onSwitchToAdvanced: vi.fn(),
    ...overrides,
  };
}

describe('SimpleModeView', () => {
  it('renders the affordability roll-up with its own classification, and hedges it', () => {
    render(<SimpleModeView {...makeProps()} />);
    expect(screen.getByText('🟢 Funded')).toBeInTheDocument();
    expect(screen.getByText(/not a lending decision/)).toBeInTheDocument();
  });

  it('renders the three Health Check indicators and nothing from the full set', () => {
    render(<SimpleModeView {...makeProps()} />);
    expect(screen.getByText('Housing Cost Ratio')).toBeInTheDocument();
    expect(screen.getByText('Interest Rate Stress Test')).toBeInTheDocument();
    expect(screen.getByText('Emergency Buffer')).toBeInTheDocument();
    // Advanced-only indicators must not leak in.
    expect(screen.queryByText('Gearing')).not.toBeInTheDocument();
    expect(screen.queryByText('Vacancy Buffer')).not.toBeInTheDocument();
    expect(screen.queryByText('Upfront Cost Ratio')).not.toBeInTheDocument();
  });

  it('exposes the six core inputs as editable controls', () => {
    const props = makeProps();
    render(<SimpleModeView {...props} />);
    for (const label of ['Property Price', 'Deposit Contribution', 'Loan Amount', 'Interest Rate', 'Loan Term', 'Available Savings']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('contains no Advanced-only tool', () => {
    render(<SimpleModeView {...makeProps()} />);
    expect(screen.queryByText(/Timeline Explorer/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Strategy Comparison/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ETF Allocation/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Offset Contributions Schedule/)).not.toBeInTheDocument();
  });

  it('discloses the counts of items that are included but not editable here', () => {
    render(<SimpleModeView {...makeProps({ incomeSourceCount: 2, personalExpenseCount: 3, offsetContributionCount: 1 })} />);
    expect(screen.getByText('2 income sources')).toBeInTheDocument();
    expect(screen.getByText('3 personal expenses')).toBeInTheDocument();
    expect(screen.getByText('1 offset contribution')).toBeInTheDocument();
  });

  it('singularises the counts at 1', () => {
    render(<SimpleModeView {...makeProps({ incomeSourceCount: 1, personalExpenseCount: 1 })} />);
    expect(screen.getByText('1 income source')).toBeInTheDocument();
    expect(screen.getByText('1 personal expense')).toBeInTheDocument();
  });

  it('shows the active-advanced notice only when a feature is actually active', () => {
    const { unmount } = render(<SimpleModeView {...makeProps({ activeAdvancedFeatures: [] })} />);
    expect(screen.queryByText(/Advanced settings are shaping these numbers/)).not.toBeInTheDocument();
    unmount();

    render(<SimpleModeView {...makeProps({ activeAdvancedFeatures: ['ETF investing', 'scheduled offset contributions'] })} />);
    expect(screen.getByText(/ETF investing, scheduled offset contributions/)).toBeInTheDocument();
  });

  it('the "View details in Advanced" button reports the switch rather than doing it itself', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<SimpleModeView {...props} />);
    await user.click(screen.getByRole('button', { name: /View details in Advanced/ }));
    expect(props.onSwitchToAdvanced).toHaveBeenCalledTimes(1);
  });

  it('colours a negative cash-remaining and a negative monthly balance as losses', () => {
    render(<SimpleModeView {...makeProps({ cashRemaining: -9937, monthlyNetBalance: -1057 })} />);
    expect(screen.getByText('-$9,937')).toHaveClass('text-red-600');
    expect(screen.getByText('-$1,057')).toHaveClass('text-red-600');
  });

  // The sign belongs outside the dollar sign - "$-9,937" reads as a typo.
  it('formats a negative figure as -$N, not $-N', () => {
    render(<SimpleModeView {...makeProps({ cashRemaining: -9937 })} />);
    expect(screen.queryByText('$-9,937')).not.toBeInTheDocument();
  });
});
