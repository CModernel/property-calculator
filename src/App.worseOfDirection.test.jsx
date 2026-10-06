// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { serializeScenarioPayload } from './persistence/scenarioStorage';

// TODO-163: worseOf(day1, stabilized, direction) picks which of the two
// readings the panel CLASSIFIES, and the classification is what drives the
// badge, the action text, the critical banner and Simple mode. The direction
// argument is the one thing at its six call sites that a typo or a copy-paste
// can flip, and a flipped direction makes a risk indicator report the
// OPTIMISTIC reading with no number on screen looking wrong - the displayed
// value is always Day 1's. Unit tests of worseOf cannot see that; only the
// rendered badge can.
//
// Every case below is a scenario where the two readings fall in DIFFERENT
// classification bands, and the assertion is the badge symbol, which is the
// classification of whichever reading won. Two mutations have to fail, and they
// are different failures:
//   * inverting a direction  - caught by every row below;
//   * deleting worseOf (classifying Day 1 alone) - caught only by the
//     "Stabilized is worse" rows, since in the "better" rows Day 1 already is
//     the worse reading.
// Both were verified by hand against each of the six call sites.
//
// The scenarios are seeded through the saved-scenario storage rather than
// clicked in, so each one is a few lines of numbers instead of a long UI
// script. They are calibrated against the shipped defaults ($850k, $543k loan
// at 6.13%, $1,614/wk salary, 2% vacancy, default growth, $350k savings
// against the default deposit, stamp duty and closing costs) - a change to those
// defaults moves them, and the comment on each row says what it relies on.

const STORAGE_KEY = 'propertyCalculator.scenario';

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  localStorage.clear();
});

const SALARY = { id: 1, name: 'Salary/Wages', amount: 1614, startMonth: 1, recurrence: 'monthly', endMonth: 360 };
const rent = (amount) => ({ id: 2, name: 'House Rent', amount, startMonth: 1, recurrence: 'monthly', endMonth: 360 });
const groceries = (amount) => ({ id: 1, name: 'Groceries', amount, startMonth: 1, recurrence: 'monthly', endMonth: 360 });
const rateChange = (amount, startMonth) => ({ interestRateChanges: [{ id: 1, amount, startMonth }] });
const ZERO_GROWTH = { salaryGrowthRate: 0, rentGrowthRate: 0, expenseGrowthRate: 0 };
// Gearing, Vacancy Buffer and Rental Yield only render for an investment
// property, which needs First Home Buyer off first.
const INVESTMENT = { isFirstHomeBuyer: false, isInvestmentProperty: true, vacancyWeeksPerYear: 0 };

async function renderScenario(overrides) {
  localStorage.setItem(STORAGE_KEY, serializeScenarioPayload({ showHealthCheck: true, ...overrides }));
  vi.resetModules();
  const { default: FreshApp } = await import('./App');
  return render(<FreshApp />);
}

function indicatorRow(label) {
  return screen.getByText(label).closest('div').parentElement;
}

// What the user reads on the right of the row: the classification's symbol next
// to the Day-1 value. The symbol is the part under test.
function badge(label) {
  return indicatorRow(label).querySelector('span.font-semibold').textContent;
}

const CASES = [
  // Defaults, but expenses grow 10%/yr against a fixed repayment: the buffer
  // drifts 6.3 -> 5.4 months, across the 6-month line.
  { name: 'Emergency Buffer, Stabilized worse', label: 'Emergency Buffer', scenario: { expenseGrowthRate: 10 }, badge: '🟠 6.3 months', arrow: '↘' },
  // A cut to 4% at month 2 plus $1,300/mo of personal spending: 5.5 -> 6.4.
  { name: 'Emergency Buffer, Stabilized better', label: 'Emergency Buffer', scenario: { ...rateChange(4, 2), personalExpenseItems: [groceries(1300)] }, badge: '🟠 5.5 months', arrow: '↗' },
  // No growth, rate jumps to 8% at month 2: 44% -> 52% of gross, across the 50% line.
  { name: 'Housing Cost Ratio, Stabilized worse', label: 'Housing Cost Ratio', scenario: { ...ZERO_GROWTH, ...rateChange(8, 2) }, badge: '🔴 44%', arrow: '↘' },
  // Shipped defaults: salary growth outpaces the fixed repayment, so the ratio improves.
  { name: 'Housing Cost Ratio, Stabilized better', label: 'Housing Cost Ratio', scenario: {}, badge: '🟠 44%', arrow: '↗' },
  // $800k loan at 6%, rising to 8% at month 300 with ~61 months left: Day 1
  // survives +3 points, Stabilized is already in deficit.
  { name: 'Stress Test, Stabilized worse', label: 'Interest Rate Stress Test', scenario: { ...ZERO_GROWTH, downPayment: 50000, interestRate: 6, ...rateChange(8, 300), incomeSources: [SALARY, { ...SALARY, id: 2, amount: 1500 }] }, badge: '🔴 Survives +3%', arrow: '↘' },
  // $2,500/mo of personal spending is tight today (survives +1 point only); a cut to 4% at month 2 fixes that.
  { name: 'Stress Test, Stabilized better', label: 'Interest Rate Stress Test', scenario: { ...rateChange(4, 2), personalExpenseItems: [groceries(2500)] }, badge: '🟠 Survives +1%', arrow: '↗' },
  // Rent $950/wk: Day 1 cash-flow positive, then 8% at month 2 flips it negative.
  { name: 'Gearing, Stabilized worse', label: 'Gearing', scenario: { ...INVESTMENT, ...ZERO_GROWTH, ...rateChange(8, 2), incomeSources: [SALARY, rent(950)] }, badge: '🟠 +$273/mo', arrow: '↘' },
  // Rent $850/wk with default 3% rent growth: negative today, positive at month 60.
  { name: 'Gearing, Stabilized better', label: 'Gearing', scenario: { ...INVESTMENT, incomeSources: [SALARY, rent(850)] }, badge: '🟠 -$160/mo', arrow: '↗' },
  // Margins are thin on a few rows (HCR better 39% vs the 40% line, Vacancy
  // ~3 months vs the 3-month line); the totalSavings values are tuned to leave
  // ~$12.5k / ~$10.5k liquid after the defaults' purchase costs.
  // Liquid savings of ~$12.5k sit between 3 months of the Day-1 cost and 3 months of the 8% cost.
  { name: 'Vacancy Buffer, Stabilized worse', label: 'Vacancy Buffer', scenario: { ...INVESTMENT, ...ZERO_GROWTH, ...rateChange(8, 2), incomeSources: [SALARY, rent(950)], totalSavings: 356700 }, badge: '🔴 3.3 months', arrow: '↘' },
  // ~$10.5k liquid: under 3 months today, over it once the rate drops to 4%.
  { name: 'Vacancy Buffer, Stabilized better', label: 'Vacancy Buffer', scenario: { ...INVESTMENT, ...ZERO_GROWTH, ...rateChange(4, 2), incomeSources: [SALARY, rent(950)], totalSavings: 354700 }, badge: '🔴 2.7 months', arrow: '↗' },
  // $900/wk with rent falling 5%/yr: 5.5% -> 4.3%, across the 5% line.
  { name: 'Rental Yield, Stabilized worse', label: 'Rental Yield', scenario: { ...INVESTMENT, rentGrowthRate: -5, incomeSources: [SALARY, rent(900)] }, badge: '🟠 5.5%', arrow: '↘' },
  // $800/wk with default 3% rent growth: 4.9% -> 5.7%.
  { name: 'Rental Yield, Stabilized better', label: 'Rental Yield', scenario: { ...INVESTMENT, incomeSources: [SALARY, rent(800)] }, badge: '🟠 4.9%', arrow: '↗' },
];

describe('Health Check classifies the worse of Day 1 and Stabilized (TODO-163)', () => {
  it.each(CASES)('$name', async ({ label, scenario, badge: expectedBadge, arrow }) => {
    await renderScenario(scenario);

    // The symbol is the classification of the WORSE reading; the value beside
    // it is always Day 1's. A flipped direction, or no worseOf at all in the
    // "worse" rows, would put the other band's symbol here.
    expect(badge(label)).toBe(expectedBadge);
    // The arrow and the badge come from the same two readings, through a
    // different function (stabilizedArrow), and the arrows had no rendered
    // coverage at all. Pinning both on the same scenario is what would expose
    // the two functions disagreeing.
    expect(within(indicatorRow(label)).getByText(new RegExp(`^${arrow} stabilizes to`))).toBeInTheDocument();
  });

  // The strongest form of the "Stabilized worse" assertion: not only the
  // symbol but the action text, which is what tells the user to do something.
  it('a Stabilized deficit shows the deficit action, not the Day-1 "survives" one', async () => {
    await renderScenario(CASES.find((c) => c.name === 'Stress Test, Stabilized worse').scenario);
    const row = indicatorRow('Interest Rate Stress Test');
    expect(within(row).getByText(/stabilizes to Already in deficit/)).toBeInTheDocument();
    expect(row.textContent).toMatch(/Already in deficit today/);
  });
});
