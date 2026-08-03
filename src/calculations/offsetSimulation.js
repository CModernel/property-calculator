import { isMonthInRange } from './dateRange';
import { calculateMonthlyRentalIncome } from './loan';

export function calculateLoanWithOffset({
  contributions,
  exceptExpenses,
  tenants = [],
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

    // Add regular monthly deposit to offset (this month's rent, minus
    // exceptional expenses). We assume exceptional expenses come out of the
    // surplus first. `monthlyToOffset` here excludes tenant rent - it's added
    // per month above instead, since a tenant's date range means it can't be
    // pre-collapsed into a single constant the way it used to be.
    const netMonthlyDeposit = Math.max(0, monthlyToOffset + monthlyRentalIncomeThisMonth - monthlyExceptionalCost);
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
