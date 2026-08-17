// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ImpactColorLegend from './ImpactColorLegend';

describe('ImpactColorLegend', () => {
  it('renders all three impact labels with their icons', () => {
    render(<ImpactColorLegend />);
    expect(screen.getByText('Costs you more')).toBeInTheDocument();
    expect(screen.getByText('Helps you')).toBeInTheDocument();
    expect(screen.getByText('Mixed / depends')).toBeInTheDocument();
    expect(screen.getByText('⬇')).toBeInTheDocument();
    expect(screen.getByText('⬆')).toBeInTheDocument();
    expect(screen.getByText('↔')).toBeInTheDocument();
  });

  it('notes that some sliders are intentionally left uncolored', () => {
    render(<ImpactColorLegend />);
    expect(screen.getByText(/left uncolored/)).toBeInTheDocument();
  });

  it('contains no interactive controls - purely a reference panel', () => {
    render(<ImpactColorLegend />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });
});
