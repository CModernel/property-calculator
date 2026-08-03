import { isMonthInRange } from './dateRange';
import { getSteppedValue } from './steppedValue';
import {
  calculateMonthlyRentalIncome,
  calculateMonthlyStrata,
  calculateMonthlyCouncil,
  calculateMonthlyPropertyExpenses,
  calculateWeeklyPersonalExpenses,
  calculateMonthlyPersonalExpenses,
} from './loan';

export function calculateLoanWithOffset({
  contributions,
  exceptExpenses,
  tenants = [],
  expenseFields = null,
  monthlyToOffset,
  loanAmount,
  monthlyRate,
  monthlyPayment,
  maxMonths = 30 * 12,
}) {
  // Nothing to offset: no surplus, no scheduled contributions, and no tenants
  // that could contribute rent in some future month. The sentinel years/
  // interest values mean "does not pay off early". `months` must be present
  // and match the full term - callers read it for the timeline bounds, and
  // omitting it used to render "Middle (NaN)" / "End (undefined)".
  if (monthlyToOffset <= 0 && tenants.length === 0 && contributions.reduce((s, c) => s + c.amount, 0) === 0) {
    return { years: 999, months: maxMonths, totalInterest: 999999, monthlyData: [] };
  }

  let balance = loanAmount;
  let offsetBalance = 0;
  let totalInterest = 0;
  let months = 0;
  const monthlyData = [];

  while (balance > 0.01 && months < maxMonths) {
    months++;

    // Apply any scheduled offset contributions for this month
    contributions.forEach(contrib => {
      if (contrib.month === months) {
        offsetBalance += contrib.amount;
      }
    });

    // Calculate Exceptional Expenses for this month
    let monthlyExceptionalCost = 0;
    exceptExpenses.forEach(exp => {
      if (exp.type === 'one-time' && exp.month === months) {
        monthlyExceptionalCost += exp.amount;
      } else if (exp.type === 'recurring') {
        if (exp.recurrence === 'forever') {
          monthlyExceptionalCost += exp.amount;
        } else if (exp.recurrence === 'period' && months >= exp.startMonth && months <= exp.endMonth) {
          monthlyExceptionalCost += exp.amount;
        }
      }
    });

    // Rent from tenants active this month. Tenants with no startMonth/endMonth
    // are always active; those with a range only contribute within it.
    const activeWeeklyRent = tenants.reduce(
      (sum, t) => (isMonthInRange(months, t.startMonth, t.endMonth) ? sum + t.amount : sum),
      0
    );
    const monthlyRentalIncomeThisMonth = calculateMonthlyRentalIncome(activeWeeklyRent);

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

    // Add regular monthly deposit to offset (this month's rent, minus this
    // month's property/personal expenses and exceptional expenses). We assume
    // exceptional expenses come out of the surplus first. `monthlyToOffset`
    // here excludes tenant rent and expenseFields - both are added/subtracted
    // per month above instead, since they can no longer be pre-collapsed into
    // a single constant once either can change mid-simulation.
    const netMonthlyDeposit = Math.max(
      0,
      monthlyToOffset + monthlyRentalIncomeThisMonth - monthlyExpensesForMonth - monthlyExceptionalCost
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
