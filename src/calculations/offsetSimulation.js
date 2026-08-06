import { getSteppedValue } from './steppedValue';
import { getActiveAmount } from './recurringAmount';
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

export function calculateLoanWithOffset({
  contributions,
  // Merged with what used to be Groceries/Transport/Phone-Internet
  // (SteppedExpenseField/expenseFields) - TODO-66 rebuilt those as regular
  // Schedule-shaped list entries here, same as any other personal expense.
  personalExpenseItems,
  otherExpenseItems = [],
  incomeSources = [],
  expenseFields = null,
  monthlyToOffset,
  loanAmount,
  monthlyRate,
  monthlyPayment,
  // TODO-57: optional {base, changes} - when given, the loop re-resolves the
  // annual rate every month and, on any month where it differs from the
  // previous one, re-amortizes the REMAINING balance over the REMAINING term
  // at the NEW rate (matching how a real variable-rate mortgage recalculates
  // its repayment) instead of just swapping the interest/principal split at a
  // stale fixed installment. Omitted entirely -> identical to the old fixed-
  // rate behavior (monthlyRate/monthlyPayment never change), so every caller
  // that doesn't pass this keeps working unchanged.
  interestRateField = null,
  // TODO-49: what share of the monthly surplus goes to the loan offset vs.
  // a separately-tracked savings balance. 100 (the default) means every
  // existing caller/test that omits this keeps the old all-to-offset
  // behavior byte-for-byte.
  offsetAllocationPct = 100,
  // TODO-80: the savings side needs a starting point to accumulate from -
  // the real caller seeds this with cashRemaining (the static "Remaining
  // Savings" figure, src/calculations/totalCashRequired.js), the actual
  // cash sitting in the bank right after settlement. Defaults to 0 so
  // existing tests that don't care about it are unaffected.
  initialSavingsBalance = 0,
  maxMonths = 30 * 12,
}) {
  // Nothing to offset: no surplus, no scheduled contributions, and no income
  // sources (including Tenants, which now live inside incomeSources) that
  // could kick in later either. The sentinel years/interest values mean
  // "does not pay off early". `months` must be present and match the full
  // term - callers read it for the timeline bounds, and omitting it used to
  // render "Middle (NaN)" / "End (undefined)".
  if (
    monthlyToOffset <= 0 &&
    incomeSources.length === 0 &&
    contributions.reduce((s, c) => s + c.amount, 0) === 0
  ) {
    return { years: 999, months: maxMonths, totalInterest: 999999, monthlyData: [] };
  }

  let balance = loanAmount;
  let offsetBalance = 0;
  let savingsBalance = initialSavingsBalance;
  let totalInterest = 0;
  let months = 0;
  const monthlyData = [];

  // The caller's monthlyToOffset already has the ORIGINAL (month-1)
  // monthlyPayment baked in (see App.jsx's baseMonthlySurplus) - a rate
  // change discovered mid-loop can only be corrected here, by adding back the
  // difference between that original payment and whatever's active this
  // month (see netMonthlyDeposit below).
  const initialMonthlyPayment = monthlyPayment;
  let currentAnnualRate = interestRateField
    ? getSteppedValue(interestRateField.base, interestRateField.changes, 1)
    : null;
  let currentMonthlyRate = monthlyRate;
  let currentMonthlyPayment = monthlyPayment;

  while (balance > 0.01 && months < maxMonths) {
    months++;

    if (interestRateField) {
      const annualRateThisMonth = getSteppedValue(interestRateField.base, interestRateField.changes, months);
      if (annualRateThisMonth !== currentAnnualRate) {
        currentAnnualRate = annualRateThisMonth;
        currentMonthlyRate = calculateMonthlyRate(currentAnnualRate);
        // +1: `months` is this (about-to-be-paid) installment's own 1-indexed
        // number, so the remaining term INCLUDES it - e.g. at months=6 of a
        // 12-month loan, 7 payments (6 through 12) are left, not 6.
        currentMonthlyPayment = calculateMonthlyPayment(balance, currentMonthlyRate, maxMonths - months + 1);
      }
    }

    // Apply any offset contributions active this month - a one-time
    // contribution (recurrence: 'none') only fires on its exact startMonth,
    // same as before; a recurring one now fires every month/quarter/year
    // within its range, same resolution as Income Sources/Exceptional Expenses.
    offsetBalance += getActiveAmount(contributions, months);

    // Personal expenses for this month - Groceries/Transport/Phone-Internet and
    // any exceptional/recurring cost the user has added, all resolved the
    // same way (TODO-66).
    const monthlyPersonalExpensesCost = getActiveAmount(personalExpenseItems, months);

    // Other Expenses (Health/Subscriptions/Entertainment/Debt Repayment/
    // Custom) - a direct per-occurrence dollar amount, same convention as
    // Exceptional Expenses above, not a $/week rate.
    const monthlyOtherExpenseItemsCost = getActiveAmount(otherExpenseItems, months);

    // Income sources active this month (salary, other income, one-time
    // payments, and Tenants) - a value that can change mid-simulation (a
    // date-ranged or one-time source) can't be pre-collapsed into a single
    // constant outside the loop, unlike the old single fortnightlyIncome
    // scalar this replaced.
    const monthlyIncomeThisMonth = calculateMonthlyFromWeekly(getActiveAmount(incomeSources, months));

    // Property expenses for this month, each resolved to whichever scheduled
    // change (if any) is in effect - same reasoning as tenant rent above: a
    // value that can change mid-simulation can't be pre-collapsed into a
    // single constant outside the loop.
    let monthlyExpensesForMonth = 0;
    if (expenseFields) {
      const strata = getSteppedValue(expenseFields.strataFees.base, expenseFields.strataFees.changes, months);
      const utilities = getSteppedValue(expenseFields.utilities.base, expenseFields.utilities.changes, months);
      const council = getSteppedValue(expenseFields.councilRates.base, expenseFields.councilRates.changes, months);
      const insurance = getSteppedValue(expenseFields.insurance.base, expenseFields.insurance.changes, months);
      const maintenance = getSteppedValue(expenseFields.maintenance.base, expenseFields.maintenance.changes, months);
      const waterRates = getSteppedValue(expenseFields.waterRates.base, expenseFields.waterRates.changes, months);
      const landTax = getSteppedValue(expenseFields.landTax.base, expenseFields.landTax.changes, months);
      const propertyManagement = getSteppedValue(
        expenseFields.propertyManagement.base,
        expenseFields.propertyManagement.changes,
        months
      );
      monthlyExpensesForMonth = calculateMonthlyPropertyExpenses({
        monthlyStrata: calculateMonthlyStrata(strata),
        utilities,
        monthlyCouncil: calculateMonthlyCouncil(council),
        insurance,
        maintenance,
        monthlyWaterRates: calculateMonthlyWaterRates(waterRates),
        monthlyLandTax: calculateMonthlyLandTax(landTax),
        propertyManagement,
      });
    }

    // Add regular monthly deposit to offset (this month's income, minus this
    // month's property/personal expenses and exceptional expenses). We
    // assume exceptional expenses come out of the surplus first.
    // `monthlyToOffset` here excludes income and expenseFields - both are
    // added/subtracted per month above instead, since neither can be
    // pre-collapsed into a single constant once either can change
    // mid-simulation. The `(initialMonthlyPayment - currentMonthlyPayment)`
    // term corrects for a rate change (TODO-57): it's 0 whenever the payment
    // hasn't changed, and otherwise reconciles monthlyToOffset's stale baked-
    // in original payment with whatever installment is actually active now.
    const netMonthlyDeposit = Math.max(
      0,
      monthlyToOffset + (initialMonthlyPayment - currentMonthlyPayment) + monthlyIncomeThisMonth - monthlyExpensesForMonth
        - monthlyPersonalExpensesCost - monthlyOtherExpenseItemsCost
    );
    // TODO-49: only offsetAllocationPct of the surplus reaches the offset -
    // the rest builds the separately-tracked savings balance instead.
    const offsetShare = netMonthlyDeposit * (offsetAllocationPct / 100);
    offsetBalance += offsetShare;
    savingsBalance += netMonthlyDeposit - offsetShare;

    // Offset cannot exceed loan balance
    const effectiveOffset = Math.min(offsetBalance, balance);

    // Balance on which interest is calculated
    const effectiveBalance = balance - effectiveOffset;

    // Monthly interest on effective balance
    const monthlyInterest = effectiveBalance * currentMonthlyRate;
    totalInterest += monthlyInterest;

    // Pay the installment (interest + principal)
    const principalPayment = currentMonthlyPayment - monthlyInterest;
    balance = Math.max(0, balance - principalPayment);

    // Save data for Timeline Explorer (Every Month)
    monthlyData.push({
      month: months,
      balance: Math.round(balance),
      offset: Math.round(effectiveOffset),
      savings: Math.round(savingsBalance),
      effectiveBalance: Math.round(effectiveBalance),
      monthlyInterestPaid: Math.round(monthlyInterest),
      totalInterestPaid: Math.round(totalInterest),
      totalPrincipalPaid: Math.round(loanAmount - balance)
    });

    // If offset >= remaining balance, we're done
    if (effectiveOffset >= balance) {
      balance = 0;
      break;
    }
  }

  return {
    years: months / 12,
    months: months,
    totalInterest: totalInterest,
    monthlyData: monthlyData
  };
}
