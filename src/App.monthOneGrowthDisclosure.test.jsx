// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// TODO-175: the static Day-1 cards carry no growth, while the engine's /
// Timeline Explorer's month 1 already carries one month of compounding
// (~$17/month of income on the defaults). The divergence is deliberate and
// pinned in projectedHealthCheck.test.js; this pins that the user is told.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('Month-1 growth disclosure (TODO-175)', () => {
  it('explains the growth offset in the shared income tooltip at both sites', () => {
    render(<App />);
    const buttons = screen.getAllByLabelText('How are these monthly income figures calculated?');
    expect(buttons).toHaveLength(2);
    buttons.forEach((button) => {
      const tooltip = button.parentElement.querySelector('[role="tooltip"]');
      expect(tooltip.textContent).toMatch(/52 ÷ 12/);
      expect(tooltip.textContent).toMatch(/no growth applied/);
      expect(tooltip.textContent).toMatch(/\$17\/month/);
    });
  });
});
