// Scenario recipes shared by the two render-level Health Check suites
// (App.worseOfDirection.test.jsx for Advanced, App.simpleModeStabilized.test.jsx
// for Simple), so both read the SAME inputs. Each case puts Day 1 and Stabilized
// in different classification bands; `badge` is what the panel shows next to the
// Day-1 value and `arrow` the direction of the "stabilizes to" note. See
// App.worseOfDirection.test.jsx for how they are calibrated.
import { serializeScenarioPayload } from '../persistence/scenarioStorage';

export const STORAGE_KEY = 'propertyCalculator.scenario';

export const SALARY = { id: 1, name: 'Salary/Wages', amount: 1614, startMonth: 1, recurrence: 'monthly', endMonth: 360 };
const rent = (amount) => ({ id: 2, name: 'House Rent', amount, startMonth: 1, recurrence: 'monthly', endMonth: 360 });
const groceries = (amount) => ({ id: 1, name: 'Groceries', amount, startMonth: 1, recurrence: 'monthly', endMonth: 360 });
const rateChange = (amount, startMonth) => ({ interestRateChanges: [{ id: 1, amount, startMonth }] });
const ZERO_GROWTH = { salaryGrowthRate: 0, rentGrowthRate: 0, expenseGrowthRate: 0 };
// Gearing, Vacancy Buffer and Rental Yield only render for an investment
// property, which needs First Home Buyer off first.
const INVESTMENT = { isFirstHomeBuyer: false, isInvestmentProperty: true, vacancyWeeksPerYear: 0 };

export const CASES = [
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


// Saves the scenario the way the app does, for a fresh import of App to read.
export function seedScenario(overrides) {
  localStorage.setItem(STORAGE_KEY, serializeScenarioPayload({ showHealthCheck: true, ...overrides }));
}
