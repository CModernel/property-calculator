// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// TODO-134: Purchase Health Check's Emergency Buffer/Housing Cost Ratio/
// Interest Rate Stress Test/Gearing/Vacancy Buffer/Rental Yield indicators
// now show a Day-1 value plus a "Stabilized" annotation (the last scheduled
// income/expense/rate change, or year 5 if nothing is scheduled).

async function openHealthCheck(user) {
  const heading = screen.getByText('🩺 Purchase Health Check');
  const toggle = within(heading.parentElement).getByRole('button', { name: '▸ Show' });
  await user.click(toggle);
}

async function openIncomeForm(user) {
  await user.click(screen.getByRole('button', { name: /Income breakdown/ }));
  await user.click(screen.getByRole('button', { name: '+ Add' }));
}

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

function emergencyBufferRow() {
  return screen.getByText('Emergency Buffer').closest('div').parentElement;
}

function rowFor(label) {
  return screen.getByText(label).closest('div').parentElement;
}

function primaryValue(row) {
  return within(row).getByText((_, node) => node?.className?.includes('font-semibold') && node.tagName === 'SPAN').textContent;
}

function stabilizedText(row) {
  return within(row).getByText(/stabilizes to/).textContent;
}

describe('Purchase Health Check Stabilized annotation (TODO-134)', () => {
  it('shows a "stabilizes to" annotation with no schedule configured, falling back to year 5', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openHealthCheck(user);

    const row = emergencyBufferRow();
    expect(within(row).getByText(/stabilizes to/)).toBeInTheDocument();
    // Tooltip explains the fallback horizon (month 60 = year 5) when nothing
    // is scheduled - proves stabilizationMonth actually reached the render.
    expect(within(row).getByText(/reflects month 60/)).toBeInTheDocument();
  });

  it('a recurring salary raise scheduled at month 24 moves the Stabilized month to 24', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openIncomeForm(user);

    // Salary/Wages is already the default category - just needs its own
    // schedule pushed out to month 24 (recurrence defaults to monthly/forever).
    fireEvent.change(screen.getByLabelText('Weekly Amount ($)'), { target: { value: '500' } });
    const startSlider = within(screen.getByText(/Start Month:/).parentElement).getByRole('slider');
    fireEvent.change(startSlider, { target: { value: '24' } });
    await user.click(screen.getByRole('button', { name: 'Add Income' }));

    await openHealthCheck(user);
    const row = emergencyBufferRow();
    expect(within(row).getByText(/reflects month 24/)).toBeInTheDocument();
  });
});

// TODO-162: five of the six "stabilizes to" annotations had no VALUE
// assertion anywhere in the suite - only existence ("contains the text
// 'stabilizes to'") or, for Housing Cost Ratio alone, a real number. That gap
// is exactly how a wrong hand-inlined conversion could ship silently: Rental
// Yield's Stabilized reading (App.jsx) is `monthlyRentalIncomeBeforeTaxAndVacancy
// * 12 / 52`, a hand-written inverse of calculateMonthlyFromWeekly with no
// shared helper. Swap the factors (`* 52 / 12`, the far more familiar
// direction) and the Stabilized yield inflates ~18.8x - but because
// worseOf(..., 'higherIsBetter') then keeps the Day-1 value for the
// CLASSIFICATION, the colour never moves and nothing else in the suite fails.
//
// Rather than hand-deriving each Stabilized figure a second time - which is
// its own risk, see TODO-151's review, where a second independently-computed
// expectation was itself wrong - every scenario below zeroes every growth
// rate. With nothing scheduled and no growth, the Stabilized reading is
// mathematically required to equal Day-1 exactly (arrow "→"), so the app's
// OWN Day-1 render becomes the oracle: no external arithmetic, and a broken
// conversion (like the *52/12 swap above) still shows up as an inequality
// between two numbers pulled off the same render.
describe('Stabilized annotations carry the correct VALUE (TODO-162)', () => {
  function zeroGrowthRates() {
    for (const label of ['Salary Growth Rate', 'Rent Growth Rate', 'Expense Growth Rate']) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: '0' } });
      fireEvent.blur(screen.getByLabelText(label));
    }
  }

  it('Emergency Buffer\'s Stabilized figure equals Day-1 at zero growth', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Projection assumptions/ }));
    zeroGrowthRates();
    await openHealthCheck(user);

    const row = emergencyBufferRow();
    const day1 = primaryValue(row);
    expect(day1).toMatch(/^🟢 \d+\.\d months$/);
    expect(stabilizedText(row)).toBe(`→ stabilizes to ${day1.replace('🟢 ', '')}`);
  });

  it('the Interest Rate Stress Test reads "Survives +3%" on the shipped default, Day-1 and Stabilized alike', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openHealthCheck(user);

    const row = rowFor('Interest Rate Stress Test');
    expect(primaryValue(row)).toBe('🟢 Survives +3%');
    expect(stabilizedText(row)).toBe('→ stabilizes to Survives +3%');
  });

  // Gearing, Vacancy Buffer and Rental Yield are all investment-property-only.
  describe('investment-property indicators', () => {
    async function makeInvestmentProperty(user) {
      await user.click(screen.getByLabelText(/First Home Buyer/));
      await user.click(screen.getByLabelText(/Investment Property/));
    }

    async function addHouseRent(user, weeklyAmount) {
      await openIncomeForm(user);
      await user.selectOptions(screen.getByDisplayValue('Salary/Wages'), 'House Rent');
      fireEvent.change(screen.getByLabelText('Weekly Rent'), { target: { value: String(weeklyAmount) } });
      fireEvent.blur(screen.getByLabelText('Weekly Rent'));
      await user.click(screen.getByRole('button', { name: 'Add Income' }));
    }

    async function setUpZeroGrowthInvestmentScenario(user) {
      await makeInvestmentProperty(user);
      await addHouseRent(user, 600);
      await user.click(screen.getByRole('button', { name: /Projection assumptions/ }));
      zeroGrowthRates();
      fireEvent.change(screen.getByLabelText('Vacancy (weeks/year)'), { target: { value: '0' } });
      fireEvent.blur(screen.getByLabelText('Vacancy (weeks/year)'));
      await openHealthCheck(user);
    }

    it('Gearing\'s Stabilized figure equals Day-1 at zero growth', async () => {
      const user = userEvent.setup();
      render(<App />);
      await setUpZeroGrowthInvestmentScenario(user);

      const row = rowFor('Gearing');
      const day1 = primaryValue(row);
      expect(day1).toMatch(/^🟠 -\$[\d,]+\/mo$/);
      expect(stabilizedText(row)).toBe(`→ stabilizes to ${day1.replace('🟠 ', '')}`);
    });

    it('Vacancy Buffer\'s Stabilized figure equals Day-1 at zero growth', async () => {
      const user = userEvent.setup();
      render(<App />);
      await setUpZeroGrowthInvestmentScenario(user);

      const row = rowFor('Vacancy Buffer');
      const day1 = primaryValue(row);
      expect(day1).toMatch(/^🔴 \d+\.\d months$/);
      expect(stabilizedText(row)).toBe(`→ stabilizes to ${day1.replace('🔴 ', '')}`);
    });

    // The sharpest case: this is the indicator whose Stabilized reading does a
    // hand-inlined `* 12 / 52` unit conversion with no shared helper. A wrong
    // direction on that conversion breaks this exact equality by ~18.8x while
    // leaving the CLASSIFICATION (and thus every other test) untouched.
    it('Rental Yield\'s Stabilized figure equals Day-1 at zero growth and zero vacancy', async () => {
      const user = userEvent.setup();
      render(<App />);
      await setUpZeroGrowthInvestmentScenario(user);

      const row = rowFor('Rental Yield');
      const day1 = primaryValue(row);
      expect(day1).toMatch(/^🟠 \d+\.\d%$/);
      expect(stabilizedText(row)).toBe(`→ stabilizes to ${day1.replace('🟠 ', '')}`);
    });
  });
});

// TODO-155's fix wired stressTestClass into summariseAffordability, but that
// wiring was pinned only by affordabilitySummary.test.js's unit fixture, not
// by anything that renders Simple mode - a call-site regression (wrong prop
// name, dropped argument) would still pass the whole suite.
//
// Isolating Stress Test's own effect on the roll-up is not as simple as
// picking a low salary: Housing Cost Ratio and Stress Test share the same
// income/property-cost inputs, and on this scenario's numbers HCR crosses
// its OWN critical threshold before Stress Test's margin gets thin enough to
// fail - so a salary cut alone makes HCR critical too, which would make the
// roll-up red regardless of whether Stress Test's classification is wired up
// at all. A large personal expense addition, by contrast, moves Stress
// Test's margin without moving HCR (personal expenses aren't part of its
// ratio) - bisected against the real render (not computed by hand) to land
// EXACTLY on a scenario where Stress Test is the only critical indicator.
describe('Simple mode\'s roll-up actually receives the Stress Test classification (TODO-155/162)', () => {
  function zeroGrowthRates() {
    for (const label of ['Salary Growth Rate', 'Rent Growth Rate', 'Expense Growth Rate']) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: '0' } });
      fireEvent.blur(screen.getByLabelText(label));
    }
  }

  it('reflects a critical Stress Test in the roll-up when neither other indicator is critical', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Projection assumptions/ }));
    zeroGrowthRates();
    await user.click(screen.getByRole('button', { name: /Personal expenses breakdown/ }));
    await user.click(within(screen.getByText('Personal Expenses').parentElement).getByRole('button', { name: '+ Add' }));
    fireEvent.change(screen.getByLabelText('Monthly Amount ($)'), { target: { value: '2300' } });
    fireEvent.blur(screen.getByLabelText('Monthly Amount ($)'));
    await user.click(screen.getByRole('button', { name: 'Add Expense' }));

    // Confirms the isolation before trusting the roll-up: Emergency Buffer and
    // Housing Cost Ratio are both merely Moderate/Caution (orange, non-critical
    // per their own band tables), and Stress Test alone is High risk (critical).
    await openHealthCheck(user);
    expect(primaryValue(emergencyBufferRow())).toBe('🟠 4.2 months');
    expect(primaryValue(rowFor('Housing Cost Ratio'))).toBe('🟠 44%');
    expect(primaryValue(rowFor('Interest Rate Stress Test'))).toBe('🔴 Fails at +1%');

    await user.click(screen.getByRole('button', { name: /Simple mode/ }));

    // The symbol, not just the "Tight but funded" text - that label covers
    // BOTH the merely-orange case and the critical one, so only the emoji
    // actually distinguishes "Stress Test's critical flag reached the
    // roll-up" from "an orange indicator would have said this anyway".
    const rollup = screen.getByText(/Tight but funded/);
    expect(rollup.textContent).toBe('🔴 Tight but funded');
  });
});
