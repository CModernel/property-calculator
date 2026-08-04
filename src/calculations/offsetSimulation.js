import { getSteppedValue } from './steppedValue';
import { getActiveAmount } from './recurringAmount';
import {
  calculateMonthlyFromWeekly,
  calculateMonthlyStrata,
  calculateMonthlyCouncil,
  calculateMonthlyPropertyExpenses,
  calculateWeeklyPersonalExpenses,
  calculateMonthlyPersonalExpenses,
} from './loan';

export function calculateLoanWithOffset({
  contributions,
  exceptExpenses,
  incomeSources = [],
  expenseFields = null,
  monthlyToOffset,
  loanAmount,
  monthlyRate,
  monthlyPayment,
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
  let totalInterest = 0;
  let months = 0;
  const monthlyData = [];

  while (balance > 0.01 && months < maxMonths) {
    months++;

    // Apply any offset contributions active this month - a one-time
    // contribution (recurrence: 'none') only fires on its exact startMonth,
    // same as before; a recurring one now fires every month/quarter/year
    // within its range, same resolution as Income Sources/Exceptional Expenses.
    offsetBalance += getActiveAmount(contributions, months);

    // Calculate Exceptional Expenses for this month
    const monthlyExceptionalCost = getActiveAmount(exceptExpenses, months);

    // Income sources active this month (salary, other income, one-time
    // payments, and Tenants) - a value that can change mid-simulation (a
    // date-ranged or one-time source) can't be pre-collapsed into a single
    // constant outside the loop, unlike the old single fortnightlyIncome
    // scalar this replaced.
    const monthlyIncomeThisMonth = calculateMonthlyFromWeekly(getActiveAmount(incomeSources, months));

    // Property/personal expenses for this month, each resolved to whichever
    // scheduled change (if any) is in effect - same reasoning as tenant rent
    // above: a value that can change mid-simulation can't be pre-collapsed
    // into a single constant outside the loop.
    let monthlyExpensesForMonth = 0;
    if (expenseFields) {
      const strata = getSteppedValue(expenseFields.strataFees.base, expenseFields.strataFees.changes, months);
      const utilities = getSteppedValue(expenseFields.utilities.base, expenseFields.utilities.changes, months);
      const council = getSteppedValue(expenseFields.councilRates.base, expenseFields.councilRates.changes, months);
      const insurance = getSteppedValue(expenseFields.insurance.base, expenseFields.insurance.changes, months);
      const food = getSteppedValue(expenseFields.foodExpenses.base, expenseFields.foodExpenses.changes, months);
      const transport = getSteppedValue(
        expenseFields.transportExpenses.base,
        expenseFields.transportExpenses.changes,
        months
      );
      const other = getSteppedValue(expenseFields.otherExpenses.base, expenseFields.otherExpenses.changes, months);

      const propertyExpenses = calculateMonthlyPropertyExpenses(
        calculateMonthlyStrata(strata),
        utilities,
        calculateMonthlyCouncil(council),
        insurance
      );
      const personalExpenses = calculateMonthlyPersonalExpenses(calculateWeeklyPersonalExpenses(food, transport, other));
      monthlyExpensesForMonth = propertyExpenses + personalExpenses;
    }

    // Add regular monthly deposit to offset (this month's income, minus this
    // month's property/personal expenses and exceptional expenses). We
    // assume exceptional expenses come out of the surplus first.
    // `monthlyToOffset` here excludes income and expenseFields - both are
    // added/subtracted per month above instead, since neither can be
    // pre-collapsed into a single constant once either can change
    // mid-simulation.
    const netMonthlyDeposit = Math.max(
      0,
      monthlyToOffset + monthlyIncomeThisMonth - monthlyExpensesForMonth - monthlyExceptionalCost
    );
    offsetBalance += netMonthlyDeposit;

    // Offset cannot exceed loan balance
    const effectiveOffset = Math.min(offsetBalance, balance);

    // Balance on which interest is calculated
    const effectiveBalance = balance - effectiveOffset;

    // Monthly interest on effective balance
    const monthlyInterest = effectiveBalance * monthlyRate;
    totalInterest += monthlyInterest;

    // Pay the installment (interest + principal)
    const principalPayment = monthlyPayment - monthlyInterest;
    balance = Math.max(0, balance - principalPayment);

    // Save data for Timeline Explorer (Every Month)
    monthlyData.push({
      month: months,
      balance: Math.round(balance),
      offset: Math.round(effectiveOffset),
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
