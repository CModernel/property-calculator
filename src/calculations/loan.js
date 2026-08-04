export const TOTAL_MONTHS = 30 * 12;

export function calculateLoanAmount(propertyPrice, downPayment) {
  return propertyPrice - downPayment;
}

export function calculateMonthlyRate(interestRate) {
  return interestRate / 100 / 12;
}

export function calculateMonthlyPayment(loanAmount, monthlyRate, totalMonths = TOTAL_MONTHS) {
  return loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
    (Math.pow(1 + monthlyRate, totalMonths) - 1);
}

export function calculateMonthlyStrata(strataFees) {
  return strataFees / 4;
}

export function calculateMonthlyCouncil(councilRates) {
  return councilRates / 4;
}

export function calculateMonthlyWaterRates(waterRates) {
  return waterRates / 4;
}

// NSW Land Tax is assessed annually.
export function calculateMonthlyLandTax(landTax) {
  return landTax / 12;
}

// A single object param instead of 8 positionals - past 4 args the risk of
// mixing up the order outweighs the terseness, and every caller passes named
// values anyway.
export function calculateMonthlyPropertyExpenses({
  monthlyStrata, utilities, monthlyCouncil, insurance,
  maintenance, monthlyWaterRates, monthlyLandTax, propertyManagement,
}) {
  return monthlyStrata + utilities + monthlyCouncil + insurance
    + maintenance + monthlyWaterRates + monthlyLandTax + propertyManagement;
}

export function calculateTotalPropertyCost(monthlyPayment, monthlyPropertyExpenses) {
  return monthlyPayment + monthlyPropertyExpenses;
}

export function getMonth1Offset(offsetContributions) {
  return offsetContributions.find(c => c.month === 1)?.amount || 0;
}

export function calculateInitialPrincipal(loanAmount, month1Offset) {
  return Math.max(0, loanAmount - month1Offset);
}

export function calculateInitialMonthlyInterest(initialPrincipal, monthlyRate) {
  return initialPrincipal * monthlyRate;
}

// Total interest on a plain loan with no offset at all: every installment is paid
// in full over the whole term, so everything above the principal is interest.
export function calculateNoOffsetTotalInterest(monthlyPayment, loanAmount, totalMonths = TOTAL_MONTHS) {
  return monthlyPayment * totalMonths - loanAmount;
}

export function calculateMonthlyPropertyBalance(monthlyRentalIncome, totalPropertyCost) {
  return monthlyRentalIncome - totalPropertyCost;
}

export function calculateWeeklyPropertyBalance(monthlyPropertyBalance) {
  return monthlyPropertyBalance * 12 / 52;
}

export function calculateWeeklyPersonalExpenses(foodExpenses, transportExpenses) {
  return foodExpenses + transportExpenses;
}

export function calculateMonthlyPersonalExpenses(weeklyPersonalExpenses) {
  return weeklyPersonalExpenses * 52 / 12;
}

export function calculateMonthlyFromWeekly(weeklyAmount) {
  return weeklyAmount * 52 / 12;
}

// Logic: (Personal Income + Rental Income) - (Personal Expenses + Property Expenses)
// Fixed in PCALC-6: must include rental income, not just personal income.
export function calculateMonthlyNetBalance(monthlyIncome, monthlyRentalIncome, monthlyPersonalExpenses, totalPropertyCost) {
  return (monthlyIncome + monthlyRentalIncome) - (monthlyPersonalExpenses + totalPropertyCost);
}

export function calculateWeeklyNetBalance(weeklyIncome, weeklyRentalIncome, weeklyPersonalExpenses, totalPropertyCost) {
  return (weeklyIncome + weeklyRentalIncome) - (weeklyPersonalExpenses + (totalPropertyCost * 12 / 52));
}

export function calculateFortnightlyNetBalance(weeklyNetBalance) {
  return weeklyNetBalance * 2;
}

export function calculateMonthlyToOffset(monthlyNetBalance) {
  return Math.max(0, monthlyNetBalance);
}

export function calculateWeeklyToOffset(weeklyNetBalance) {
  return Math.max(0, weeklyNetBalance);
}

export function calculateFortnightlyToOffset(fortnightlyNetBalance) {
  return Math.max(0, fortnightlyNetBalance);
}

// Only one-time contributions count as "already reserved from today's
// savings" - a recurring contribution (e.g. "$500 every quarter") comes out
// of future cash flow, the same as the automatic monthly surplus, not a
// chunk of savings sitting in the bank right now.
export function calculateTotalScheduledOffset(offsetContributions) {
  return offsetContributions
    .filter(contrib => contrib.recurrence === 'none')
    .reduce((sum, contrib) => sum + contrib.amount, 0);
}
