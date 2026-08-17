import { getActiveAmount, getActiveAmountWithGrowth, MAX_MONTH } from './recurringAmount';
import { getSteppedValue } from './steppedValue';
import { calculateCompoundedValue } from './growthRate';
import { SALARY_INCOME_CATEGORY, RENTAL_INCOME_CATEGORIES } from './incomeCategories';
import {
  calculateMonthlyFromWeekly,
  calculateMonthlyRate,
  calculateMonthlyPayment,
  calculateMonthlyStrata,
  calculateMonthlyCouncil,
  calculateMonthlyWaterRates,
  calculateMonthlyLandTax,
  calculateMonthlyPropertyExpenses,
} from './loan';

// TODO-134: several Health Check indicators only ever look at month 1, so
// they miss both scheduled income/expense changes AND the growth rates
// TODO-141 made always-active. This module answers "what would these figures
// look like once things settle down" - entirely independently of
// offsetSimulation.js. That file's monthlyData doesn't carry per-month
// income/expense figures at all (they're local loop variables, discarded
// after each iteration), and none of the six affected indicators actually
// need the loan simulation's own bookkeeping (offset/balance/interest) - they
// only need income/expense SCHEDULES resolved at a different month, which is
// exactly what getActiveAmountWithGrowth/getSteppedValue already do. Keeping
// this independent avoids coupling Health Check to the heavily-tested
// simulation loop.
//
// Default horizon when nothing is scheduled, so "Stabilized" is never
// undefined for a scenario with completely flat inputs.
export const DEFAULT_STABILIZATION_MONTH = 60;

// Only RECURRING items count - a one-time lump sum is a transient blip, not
// a new steady state, so it shouldn't move the point we call "stabilized".
function lastRecurringChangeMonth(items) {
  let last = 0;
  for (const item of items) {
    if (item.recurrence === 'none') continue;
    if (item.startMonth > 1) last = Math.max(last, item.startMonth);
    if (item.endMonth < MAX_MONTH) last = Math.max(last, item.endMonth);
  }
  return last;
}

// Every entry in a SteppedExpenseField's `changes` array (steppedValue.js)
// already represents a real scheduled adjustment by construction - no
// recurrence field to filter on, unlike income/personal-expense items.
function lastSteppedChangeMonth(changes) {
  return changes.reduce((last, c) => Math.max(last, c.startMonth), 0);
}

// The month the LAST scheduled income/expense/rate change fires, across
// every schedule-bearing input in the app. Offset Contributions deliberately
// excluded - they bypass income/expenses entirely (same bypass TODO-129's
// negative gearing uses), so they don't affect any of these six indicators.
export function findStabilizationMonth({ incomeSources, personalExpenseItems, expenseFields, interestRateField }) {
  let last = Math.max(
    lastRecurringChangeMonth(incomeSources),
    lastRecurringChangeMonth(personalExpenseItems)
  );
  for (const field of Object.values(expenseFields)) {
    last = Math.max(last, lastSteppedChangeMonth(field.changes));
  }
  if (interestRateField) {
    last = Math.max(last, lastSteppedChangeMonth(interestRateField.changes));
  }
  return last > 0 ? last : DEFAULT_STABILIZATION_MONTH;
}

// The same figures App.jsx's Day-1 Health Check code computes at month 1
// (App.jsx:490-518, 539-542), re-evaluated at an arbitrary month with growth
// applied - the same salary/rental/other category split offsetSimulation.js
// uses internally (so growth compounds identically either way), regrouped
// into the rental-vs-non-rental buckets the Day-1 code already uses.
export function resolveProjectedFinancials(month, {
  incomeSources, personalExpenseItems, expenseFields, interestRateField,
  effectiveTaxRate, salaryGrowthRate, rentGrowthRate, expenseGrowthRate, vacancyWeeksPerYear,
  loanAmount, monthlyPayment, interestRate, totalMonths,
}) {
  const salarySources = incomeSources.filter((i) => i.name === SALARY_INCOME_CATEGORY);
  const rentalSources = incomeSources.filter((i) => RENTAL_INCOME_CATEGORIES.includes(i.name));
  const otherNonRentalSources = incomeSources.filter(
    (i) => i.name !== SALARY_INCOME_CATEGORY && !RENTAL_INCOME_CATEGORIES.includes(i.name)
  );
  const vacancyFactor = 1 - (vacancyWeeksPerYear / 52);

  const monthlyIncome = calculateMonthlyFromWeekly(
    getActiveAmountWithGrowth(salarySources, month, salaryGrowthRate, effectiveTaxRate)
      + getActiveAmount(otherNonRentalSources, month, effectiveTaxRate)
  );
  const monthlyRentalIncome = calculateMonthlyFromWeekly(
    getActiveAmountWithGrowth(rentalSources, month, rentGrowthRate, effectiveTaxRate) * vacancyFactor
  );

  const expenseGrowthMultiplier = calculateCompoundedValue(1, expenseGrowthRate, month);
  const monthlyPersonalExpenses = getActiveAmount(personalExpenseItems, month) * expenseGrowthMultiplier;

  const strata = getSteppedValue(expenseFields.strataFees.base, expenseFields.strataFees.changes, month);
  const utilities = getSteppedValue(expenseFields.utilities.base, expenseFields.utilities.changes, month);
  const council = getSteppedValue(expenseFields.councilRates.base, expenseFields.councilRates.changes, month);
  const insurance = getSteppedValue(expenseFields.insurance.base, expenseFields.insurance.changes, month);
  const maintenance = getSteppedValue(expenseFields.maintenance.base, expenseFields.maintenance.changes, month);
  const waterRates = getSteppedValue(expenseFields.waterRates.base, expenseFields.waterRates.changes, month);
  const landTax = getSteppedValue(expenseFields.landTax.base, expenseFields.landTax.changes, month);
  const propertyManagement = getSteppedValue(expenseFields.propertyManagement.base, expenseFields.propertyManagement.changes, month);
  const miscPropertyExpense = expenseFields.miscPropertyExpense
    ? getSteppedValue(expenseFields.miscPropertyExpense.base, expenseFields.miscPropertyExpense.changes, month)
    : 0;
  const monthlyPropertyExpenses = calculateMonthlyPropertyExpenses({
    monthlyStrata: calculateMonthlyStrata(strata),
    utilities,
    monthlyCouncil: calculateMonthlyCouncil(council),
    insurance,
    maintenance,
    monthlyWaterRates: calculateMonthlyWaterRates(waterRates),
    monthlyLandTax: calculateMonthlyLandTax(landTax),
    propertyManagement,
    miscPropertyExpense,
  }) * expenseGrowthMultiplier;

  // Deliberately independent of the loan simulation's own re-amortization:
  // the ORIGINAL loanAmount, never the offset-reduced balance (that's the
  // simulation's concern). Only recompute the payment if a genuinely
  // scheduled rate change applies by this month - same "+1 remaining term
  // includes this installment" convention offsetSimulation.js's own TODO-57
  // re-amortization uses.
  let resolvedInterestRate = interestRate;
  let resolvedMonthlyPayment = monthlyPayment;
  if (interestRateField) {
    const scheduledRate = getSteppedValue(interestRateField.base, interestRateField.changes, month);
    if (scheduledRate !== interestRate) {
      resolvedInterestRate = scheduledRate;
      resolvedMonthlyPayment = calculateMonthlyPayment(loanAmount, calculateMonthlyRate(scheduledRate), totalMonths - month + 1);
    }
  }

  return {
    monthlyIncome,
    monthlyRentalIncome,
    monthlyPersonalExpenses,
    monthlyPropertyExpenses,
    monthlyPayment: resolvedMonthlyPayment,
    interestRate: resolvedInterestRate,
  };
}

// "Worse" isn't a consistent array-index direction across purchaseHealthCheck
// .js's BANDS arrays - some are declared best-first (Emergency Buffer),
// others worst-first (Housing Cost Ratio) - so it must be resolved on the
// raw value, in the caller's own known direction, before classifying.
export function worseOf(day1Value, stabilizedValue, direction) {
  return direction === 'higherIsWorse'
    ? Math.max(day1Value, stabilizedValue)
    : Math.min(day1Value, stabilizedValue);
}
