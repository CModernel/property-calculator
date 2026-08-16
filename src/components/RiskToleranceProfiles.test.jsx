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
    render(<RiskToleranceProfiles emergencyBufferMonths={4.2} emergencyBufferClassification={{ label: 'Moderate', symbol: '🟠', textClass: 'text-orange-600 dark:text-orange-400', critical: false, action: '' }} />);
    expect(screen.getByText(/4\.2 months \(Moderate\)/)).toBeInTheDocument();
  });

  it('shows the infinity symbol rather than a number when there are no monthly outgoings', () => {
    render(<RiskToleranceProfiles emergencyBufferMonths={Infinity} emergencyBufferClassification={GOOD_CLASSIFICATION} />);
    expect(screen.getByText(/∞ \(Good\)/)).toBeInTheDocument();
  });

  it('contains no interactive controls - purely a reference panel', () => {
    render(<RiskToleranceProfiles emergencyBufferMonths={8} emergencyBufferClassification={GOOD_CLASSIFICATION} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
