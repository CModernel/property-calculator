// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InfoTooltip from './InfoTooltip';

describe('InfoTooltip', () => {
  it('renders the trigger button with the given aria-label and the tooltip content', () => {
    render(<InfoTooltip label="What does this do?">Explanation text.</InfoTooltip>);
    expect(screen.getByRole('button', { name: 'What does this do?' })).toBeInTheDocument();
    expect(screen.getByText('Explanation text.')).toBeInTheDocument();
  });

  it('is closed by default and opens when the trigger is clicked (TODO-114 touch fallback)', () => {
    render(<InfoTooltip label="What does this do?">Explanation text.</InfoTooltip>);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveClass('invisible');

    fireEvent.click(screen.getByRole('button', { name: 'What does this do?' }));
    expect(tooltip).toHaveClass('visible');
  });

  it('closes again when clicking outside', () => {
    render(<InfoTooltip label="What does this do?">Explanation text.</InfoTooltip>);
    fireEvent.click(screen.getByRole('button', { name: 'What does this do?' }));
    expect(screen.getByRole('tooltip')).toHaveClass('visible');

    fireEvent.click(document.body);
    expect(screen.getByRole('tooltip')).toHaveClass('invisible');
  });

  it('clicking the trigger again toggles it back closed, undisturbed by the outside-click handler', () => {
    render(<InfoTooltip label="What does this do?">Explanation text.</InfoTooltip>);
    const button = screen.getByRole('button', { name: 'What does this do?' });

    fireEvent.click(button);
    expect(screen.getByRole('tooltip')).toHaveClass('visible');

    fireEvent.click(button);
    expect(screen.getByRole('tooltip')).toHaveClass('invisible');
  });
});
