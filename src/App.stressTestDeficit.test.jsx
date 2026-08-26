// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// TODO-148: calculateStressTestSurvivedDelta returns 0 both when a scenario is
// already in deficit at today's rate and when it only fails once rates rise a
// point. Distinguishes the two in the UI: "Already in deficit" vs "Fails at
// +1%". The calculation itself is pinned unchanged in
// purchaseHealthCheck.test.js.
//
// Note both sub-cases share the same 🔴 High risk classification/action text
// (the action is written to be honest about either one - "Already in deficit
// today, OR a 1-point rate rise would put you there"), so it always contains
// the phrase "Already in deficit" regardless of which sub-case is active.
// These tests therefore check the PRIMARY VALUE span specifically, not
// "the phrase appears nowhere in the row".

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

async function openHealthCheck(user) {
  const heading = screen.getByText('🩺 Purchase Health Check');
  const toggle = within(heading.parentElement).getByRole('button', { name: '▸ Show' });
  await user.click(toggle);
}

function stressTestRow() {
  return screen.getByText('Interest Rate Stress Test').closest('div').parentElement;
}

// The symbol and value share one <span>, rendered as adjacent text nodes - the
// primary value's own combined text, scoped away from the Stabilized
// annotation and action paragraphs below it.
function stressTestPrimaryValue(row) {
  return within(row).getByText((_, node) => node?.className?.includes('font-semibold') && node.tagName === 'SPAN').textContent;
}

// Replaces the default Salary/Wages income source's amount by removing it and
// re-adding at the given weekly figure - there is no inline edit flow.
async function setSalary(user, weeklyAmount) {
  await user.click(screen.getByRole('button', { name: /Income breakdown/ }));
  await user.click(screen.getByRole('button', { name: '✕' }));
  await user.click(screen.getByRole('button', { name: '+ Add' }));
  fireEvent.change(screen.getByLabelText('Weekly Amount ($)'), { target: { value: String(weeklyAmount) } });
  fireEvent.blur(screen.getByLabelText('Weekly Amount ($)'));
  await user.click(screen.getByRole('button', { name: 'Add Income' }));
}

describe('Interest Rate Stress Test deficit display (TODO-148)', () => {
  it('shows "Fails at +1%" for a scenario that is positive today but not at +1%', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Verified against the real calculation: $1,100/wk nets +$243/month today
    // (not in deficit) but survives 0 points of rate rise.
    await setSalary(user, 1100);
    await openHealthCheck(user);

    expect(stressTestPrimaryValue(stressTestRow())).toBe('🔴 Fails at +1%');
  });

  // TODO-147's matrix pins this exact scenario at ST: 0 High risk, netNow -1057
  // - i.e. already in deficit before any rate rise is applied.
  it('shows "Already in deficit" for a scenario that is underwater at today\'s rate', async () => {
    const user = userEvent.setup();
    render(<App />);
    await setSalary(user, 800);
    await openHealthCheck(user);

    expect(stressTestPrimaryValue(stressTestRow())).toBe('🔴 Already in deficit');
  });

  it('the classification stays High risk and critical in both cases - only the wording changes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await setSalary(user, 800);
    await openHealthCheck(user);

    const row = stressTestRow();
    expect(stressTestPrimaryValue(row)).toContain('🔴');
    expect(within(row).getByText(/Already in deficit today, or a 1-point rate rise would put you there/)).toBeInTheDocument();
  });

  // TODO-156: every assertion above scopes to the Advanced panel, which is why
  // nobody noticed Simple mode had re-implemented the pre-fix ternary and was
  // never passed alreadyInDeficitAtCurrentRate - the same scenario answered
  // "Already in deficit" in one mode and "Fails at +1%" in the other, with
  // Simple mode's own roll-up already saying "Monthly shortfall" right above it.
  it('Simple mode gives the same answer as the Advanced panel for the same scenario', async () => {
    const user = userEvent.setup();
    render(<App />);
    await setSalary(user, 800);

    await openHealthCheck(user);
    const advanced = stressTestPrimaryValue(stressTestRow());
    expect(advanced).toBe('🔴 Already in deficit');

    await user.click(screen.getByRole('button', { name: /Simple mode/ }));
    expect(stressTestPrimaryValue(stressTestRow())).toBe(advanced);
  });
});
