// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LvrBadge from './LvrBadge';
import { classifyLvr, LVR_BANDS } from '../calculations/classifyLvr';

describe('LvrBadge', () => {
  it('renders the correct symbol and aria-label for a given lvr', () => {
    render(<LvrBadge lvr={85} />);
    const classification = classifyLvr(85);
    const button = screen.getByRole('button', { name: `LVR risk: ${classification.summary} (${classification.band})` });
    expect(button).toHaveTextContent(classification.symbol);
  });

  it('highlights only the row matching the current band in the tooltip table', () => {
    render(<LvrBadge lvr={85} />);
    const currentBand = classifyLvr(85);
    const highlightedRow = screen.getByText(currentBand.band).closest('tr');
    expect(highlightedRow).toHaveClass('bg-gray-100');

    for (const band of LVR_BANDS) {
      if (band === currentBand) continue;
      const row = screen.getByText(band.band).closest('tr');
      expect(row).not.toHaveClass('bg-gray-100');
    }
  });

  it('opens the tooltip when tapped and closes again when clicking outside (TODO-114 touch fallback)', () => {
    render(<LvrBadge lvr={85} />);
    const button = screen.getByRole('button', { name: /^LVR risk:/ });
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveClass('invisible');

    fireEvent.click(button);
    expect(tooltip).toHaveClass('visible');

    fireEvent.click(document.body);
    expect(tooltip).toHaveClass('invisible');
  });
});
