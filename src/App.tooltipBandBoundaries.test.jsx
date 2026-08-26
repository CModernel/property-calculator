// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// TODO-161: classifyByBands (purchaseHealthCheck.js) resolves a band with
// `value >= band.min`, so the boundary value belongs to the HIGHER band. Two
// tooltips stated an exclusive `>` at that boundary instead, disagreeing with
// the classification the very same row renders - the other five tooltips in
// this panel already use the inclusive ≥ phrasing.
//
// Each test renders the indicator solidly inside the "highest" band rather
// than trying to land exactly on the boundary float - Mortgage-Free Age is
// currentAge + a simulated (offset-accelerated) payoff duration, which isn't
// a value this suite can dial to an exact integer without hard-coding the
// simulation's own arithmetic. The tooltip's wording is static regardless of
// which value triggers it, so what matters is that the rendered classification
// and the tooltip's own claim about that classification agree.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('Mortgage-Free Age tooltip agrees with its own band', () => {
  it('says ≥70 late, not >70 late, matching a Late classification', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Advanced Assumptions/ }));
    await user.click(screen.getByRole('checkbox', { name: /Show my Mortgage-Free Age/ }));
    // Comfortably clears 70 regardless of the simulation's own payoff-speed
    // arithmetic, without hard-coding it.
    const ageInput = screen.getByLabelText('Your Current Age');
    await user.clear(ageInput);
    await user.type(ageInput, '65');
    await user.tab();

    const heading = screen.getByText('🩺 Purchase Health Check');
    await user.click(within(heading.parentElement).getByRole('button', { name: '▸ Show' }));
    const row = screen.getByText('Mortgage-Free Age').closest('div').parentElement;
    expect(within(row).getByText(/^🔴 \d+$/)).toBeInTheDocument();
    expect(within(row).getByText('Consider a shorter term or higher contributions.')).toBeInTheDocument();

    const tooltip = within(row).getByRole('tooltip');
    expect(tooltip).toHaveTextContent('≥70 late');
    expect(tooltip).not.toHaveTextContent('>70 late');
  });
});

describe('Offset Utilisation tooltip agrees with its own band', () => {
  it('says ≥20% strong, not >20% strong, matching a Strong classification', () => {
    render(<App />);

    // Timeline Explorer renders unconditionally, no expand step (see
    // App.timelineIncomeGrowth.test.jsx). config.default.json's offset
    // (contributions accumulate from month 1) overtakes the loan balance well
    // before the simulation's end, so a late month is comfortably Strong.
    const monthSlider = screen.getByLabelText('Viewing month');
    fireEvent.change(monthSlider, { target: { value: '300' } });

    const row = screen.getByText('Offset Utilisation (this month)').closest('div').parentElement;
    expect(within(row).getByText(/^🟢 \d+\.\d%$/)).toBeInTheDocument();

    const tooltip = within(row).getByRole('tooltip');
    expect(tooltip).toHaveTextContent('≥20% strong');
    expect(tooltip).not.toHaveTextContent('>20% strong');
  });
});
