// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RiskToleranceProfiles from './RiskToleranceProfiles';

const GOOD_CLASSIFICATION = { label: 'Good', symbol: '🟢', textClass: 'text-green-600 dark:text-green-400', critical: false, action: 'Solid buffer for most emergencies.' };

describe('RiskToleranceProfiles', () => {
  it('renders all three profiles with an illustrative range, never a single precise percentage', () => {
    render(<RiskToleranceProfiles emergencyBufferMonths={8} emergencyBufferClassification={GOOD_CLASSIFICATION} />);

    for (const label of ['Conservative', 'Moderate', 'Aggressive']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Every range is a "~X-Y%" band, not a bare number.
    expect(screen.getByText('~10-30%')).toBeInTheDocument();
    expect(screen.getByText('~30-60%')).toBeInTheDocument();
    expect(screen.getByText('~60-90%')).toBeInTheDocument();
  });

  it('renders the disclaimer that no button here touches the ETF Allocation slider', () => {
    render(<RiskToleranceProfiles emergencyBufferMonths={8} emergencyBufferClassification={GOOD_CLASSIFICATION} />);
    expect(screen.getByText(/not personal advice/)).toBeInTheDocument();
    expect(screen.getByText(/there's no button that applies these/)).toBeInTheDocument();
  });

  it('reflects the passed-in Emergency Buffer reading rather than a hardcoded figure', () => {
    render(<RiskToleranceProfiles emergencyBufferMonths={4.2} liquidSavings={19000} emergencyBufferClassification={{ label: 'Moderate', symbol: '🟠', textClass: 'text-orange-600 dark:text-orange-400', critical: false, action: '' }} />);
    expect(screen.getByText(/4\.2 months \(Moderate\)/)).toBeInTheDocument();
  });

  it('shows the infinity symbol rather than a number when there are no monthly outgoings', () => {
    render(<RiskToleranceProfiles emergencyBufferMonths={Infinity} liquidSavings={28000} emergencyBufferClassification={GOOD_CLASSIFICATION} />);
    expect(screen.getByText(/∞ \(Good\)/)).toBeInTheDocument();
  });

  // TODO-156: this panel kept a third inline copy of the buffer wording that
  // guarded only Number.isFinite, and its call site never passed liquidSavings
  // - so it still printed "-0.3 months (High risk)" next to advice to fund the
  // buffer first, long after TODO-149 fixed the Advanced panel and Simple mode.
  it('says the settlement cannot be covered rather than printing a negative month count', () => {
    const critical = { label: 'High risk', symbol: '🔴', textClass: 'text-red-600 dark:text-red-400', critical: true, action: '' };
    render(<RiskToleranceProfiles emergencyBufferMonths={-0.33} liquidSavings={-2000} emergencyBufferClassification={critical} />);
    expect(screen.getByText(/Can't cover settlement \(High risk\)/)).toBeInTheDocument();
    expect(screen.queryByText(/-0\.3 months/)).not.toBeInTheDocument();
  });

  it('contains no interactive controls - purely a reference panel', () => {
    render(<RiskToleranceProfiles emergencyBufferMonths={8} emergencyBufferClassification={GOOD_CLASSIFICATION} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
