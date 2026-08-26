// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { serializeScenarioPayload } from './persistence/scenarioStorage';

// TODO-158: Rental Yield's data-presence gate read a figure resolved AT month 1,
// so rent scheduled to start later - a settlement with a tenant moving in next
// year - read as "no rental income entered". The fallback then told the user to
// add a House Rent source they had already added, and suppressed a Stabilized
// reading that had a real figure.
//
// TODO-150 gave the gate its pre-vacancy basis so the 52-week (factor exactly 0)
// case still counts as "rent entered"; this is the other axis of the same
// question - the schedule rather than the haircut.

const STORAGE_KEY = 'propertyCalculator.scenario';
const SALARY = { id: 1, name: 'Salary/Wages', amount: 1614, startMonth: 1, recurrence: 'monthly', endMonth: 360 };
const NO_DATA_COPY = /Rental Yield: not enough data yet/;

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  localStorage.clear();
});

async function renderWithScenario(overrides) {
  localStorage.setItem(STORAGE_KEY, serializeScenarioPayload(overrides));
  vi.resetModules();
  const { default: FreshApp } = await import('./App');
  return render(<FreshApp />);
}

async function openHealthCheck(user) {
  const heading = screen.getByText('🩺 Purchase Health Check');
  await user.click(within(heading.parentElement).getByRole('button', { name: '▸ Show' }));
}

function rentalYieldRow() {
  return screen.getByText('Rental Yield').closest('div').parentElement;
}

describe('Rental Yield with rental income scheduled to start after month 1 (TODO-158)', () => {
  it('shows the indicator rather than telling the user to add income they already added', async () => {
    const user = userEvent.setup();
    await renderWithScenario({
      isInvestmentProperty: true,
      incomeSources: [
        SALARY,
        { id: 2, name: 'House Rent', amount: 700, startMonth: 13, recurrence: 'monthly', endMonth: 360 },
      ],
    });
    await openHealthCheck(user);

    expect(screen.queryByText(NO_DATA_COPY)).not.toBeInTheDocument();
    // The Stabilized reading is the one with a real figure - Day 1 is genuinely
    // 0%, and the panel is meant to show both rather than hide the row.
    expect(within(rentalYieldRow()).getByText(/stabilizes to \d/)).toBeInTheDocument();
  });

  // The gate still has to say "no" when there really is no rental income - it
  // was only ever pinned in the opposite direction before this.
  it('still shows the fallback when no rental income exists at any month', async () => {
    const user = userEvent.setup();
    await renderWithScenario({ isInvestmentProperty: true, incomeSources: [SALARY] });
    await openHealthCheck(user);

    expect(screen.getByText(NO_DATA_COPY)).toBeInTheDocument();
    expect(screen.queryByText('Rental Yield')).not.toBeInTheDocument();
  });
});
