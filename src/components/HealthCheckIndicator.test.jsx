// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HealthCheckIndicator from './HealthCheckIndicator';

const classification = {
  symbol: '🟢',
  textClass: 'text-green-600 dark:text-green-400',
  action: 'Comfortable buffer - keep it up.',
};

describe('HealthCheckIndicator', () => {
  it('renders the label, value, and classification symbol', () => {
    render(
      <HealthCheckIndicator label="Emergency Buffer" valueDisplay="12 months" classification={classification} />
    );
    expect(screen.getByText('Emergency Buffer')).toBeInTheDocument();
    expect(screen.getByText('🟢 12 months')).toBeInTheDocument();
  });

  it('shows the InfoTooltip only when children is passed', () => {
    const { rerender } = render(
      <HealthCheckIndicator label="Emergency Buffer" valueDisplay="12 months" classification={classification} />
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <HealthCheckIndicator label="Emergency Buffer" tooltipLabel="What is this?" valueDisplay="12 months" classification={classification}>
        Some explanation.
      </HealthCheckIndicator>
    );
    expect(screen.getByRole('button', { name: 'What is this?' })).toBeInTheDocument();
  });

  it('shows the action paragraph only when classification.action is truthy', () => {
    const { rerender } = render(
      <HealthCheckIndicator label="Emergency Buffer" valueDisplay="12 months" classification={classification} />
    );
    expect(screen.getByText(classification.action)).toBeInTheDocument();

    rerender(
      <HealthCheckIndicator label="Emergency Buffer" valueDisplay="12 months" classification={{ ...classification, action: undefined }} />
    );
    expect(screen.queryByText(classification.action)).not.toBeInTheDocument();
  });

  it('shows the secondary value annotation only when secondaryValueDisplay is passed', () => {
    const { rerender } = render(
      <HealthCheckIndicator label="Emergency Buffer" valueDisplay="12 months" classification={classification} />
    );
    expect(screen.queryByText(/stabilizes to/)).not.toBeInTheDocument();

    rerender(
      <HealthCheckIndicator
        label="Emergency Buffer"
        valueDisplay="12 months"
        secondaryValueDisplay="↗ stabilizes to 15.0 months"
        classification={classification}
      />
    );
    expect(screen.getByText('↗ stabilizes to 15.0 months')).toBeInTheDocument();
  });
});
