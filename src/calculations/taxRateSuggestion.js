import { getActiveAmount } from './recurringAmount';
import { calculateMonthlyFromWeekly } from './loan';
import { calculateEffectiveTaxRate } from './auTaxBrackets';

// TODO-122: turns the user's own entered income into a suggested Effective Tax
// Rate. Kept separate from auTaxBrackets.js so that file stays pure ATO data,
// with no knowledge of this app's income shape.

const MONTHS_PER_YEAR = 12;

// Only GROSS-marked items count. A net-entered item's pre-tax figure can't be
// recovered without already knowing the tax rate - which is the very thing being
// suggested - so including it would be circular. Gross items keep their pre-tax
// `amount` untouched (getNetAmount converts at read time only), so this figure
// is exact rather than reverse-engineered.
export function sumGrossAnnualIncome(incomeSources) {
  const grossItems = incomeSources.filter((item) => item.isGross);

  // Summing the app's OWN monthly figure across a year, rather than inventing a
  // per-recurrence annualisation rule. This is correct for every recurrence by
  // construction and reuses already-tested code. A naive `amount * 52` would be
  // a real bug: a one-time gross bonus is active in exactly one month, so it
  // would annualise to 52x its actual value. No tax rate is passed, so
  // getNetAmount returns each raw pre-tax amount.
  let annual = 0;
  for (let month = 1; month <= MONTHS_PER_YEAR; month++) {
    annual += calculateMonthlyFromWeekly(getActiveAmount(grossItems, month));
  }
  return annual;
}

// Returns null - not 0 - when there's nothing to base a suggestion on, so the UI
// can tell "no Gross-marked income entered" apart from "the suggested rate is
// genuinely 0%" (which is what an income below the tax-free threshold gives).
export function getSuggestedTaxRate(incomeSources) {
  const annualGrossIncome = sumGrossAnnualIncome(incomeSources);
  if (annualGrossIncome <= 0) return null;
  return {
    annualGrossIncome,
    suggestedRatePct: calculateEffectiveTaxRate(annualGrossIncome),
  };
}
