import { getActiveAmount, getActiveAmountWithGrowth } from './recurringAmount';
import { TAXABLE_INCOME_CATEGORIES } from './incomeCategories';

// TODO-151: reconstructs BEFORE-TAX income, for the two Health Check indicators
// whose bands cite an externally-defined pre-tax benchmark - Housing Cost Ratio
// (the 30/40/50 rule) and Rental Yield (the 3%/5% gross-yield bands). Every
// other indicator is about actual cash and correctly keeps the net figures.
//
// Deliberately a separate module rather than a sibling of `getNetAmount` inside
// recurringAmount.js: incomeCategories.js already imports MAX_MONTH from
// recurringAmount.js AND dereferences it at module-evaluation time, so a
// taxability-aware helper living there would close an import cycle whose
// failure is order-dependent - the app would crash on boot (recurringAmount
// entered first, MAX_MONTH still in TDZ) while a unit test importing
// incomeCategories first would pass. This module is safe because
// incomeCategories.js never imports it back. Single-function-module precedent:
// safePercentage.js, vacancyFactor.js.
//
// "Before tax" means something different for each of three groups, which is why
// this can't be one multiplier over the net total:
//   1. isGross-marked items (any category) - the stored `amount` ALREADY is the
//      pre-tax figure, so it's taken at face value. No synthesis at all, and
//      dividing it again would inflate it twice.
//   2. non-gross AND taxable - the user gave a take-home figure, so the pre-tax
//      one is `amount / (1 - rate)`. The only synthesised part, and only ever as
//      good as the flat rate the user set.
//   3. non-gross AND non-taxable - nothing was withheld, so net IS gross.
//      Grossing these up would invent money (see TAXABLE_INCOME_CATEGORIES).
export function isGrossUppable(item) {
  return !item.isGross && TAXABLE_INCOME_CATEGORIES.includes(item.name);
}

// Clamped to 1 outside (0, 100), which is NOT the same judgement call
// vacancyFactor.js makes ("deliberately NOT clamped"). There, an out-of-range
// value errs conservative; here a rate of 100 would divide by zero, give an
// Infinite denominator, and render Housing Cost Ratio as 0% -> "Excellent,
// plenty of headroom" - falsely reassuring, the one direction a risk indicator
// must never fail in. Reachable despite the slider's own [0, 90] clamp, because
// the initial value comes from config/a saved scenario with no validation.
export function calculateGrossUpFactor(effectiveTaxRate) {
  if (!(effectiveTaxRate > 0) || effectiveTaxRate >= 100) return 1;
  return 1 / (1 - effectiveTaxRate / 100);
}

// Written as a DELTA on top of the untouched full-array sum, rather than as
// two sums over two subsets. This reads like a micro-optimisation but is an
// exactness guarantee: float addition isn't associative, so summing two
// partitions can differ in the last bit from summing the whole array. Here the
// first term iterates the same array in the same order as the net path, and at
// a 0% rate `factor - 1` is exactly 0, so the whole thing is BITWISE equal to
// the net figure - which is what lets the no-op be pinned with toBe, and what
// keeps `projectionIsFlatBaseline` coherent at 0%.
export function getGrossActiveAmount(items, month, effectiveTaxRate = 0) {
  const delta = calculateGrossUpFactor(effectiveTaxRate) - 1;
  // Not a micro-optimisation: `0 * NaN` is NaN, not 0, so without this the
  // documented no-op would be broken by a single malformed `amount` anywhere in
  // the list - at a 0% rate, where nothing should be able to change the answer.
  if (delta === 0) return getActiveAmount(items, month, 0);
  return getActiveAmount(items, month, 0)
    + delta * getActiveAmount(items.filter(isGrossUppable), month, 0);
}

// The Stabilized reading's counterpart (TODO-134). The growth multiplier is
// applied per item, so `(f-1) * Sum(a*g)` equals `Sum((f-1)*a*g)` - the gross-up
// commutes with compounding, and each caller passes its own bucket's rate.
export function getGrossActiveAmountWithGrowth(items, month, annualGrowthRate, effectiveTaxRate = 0) {
  const delta = calculateGrossUpFactor(effectiveTaxRate) - 1;
  if (delta === 0) return getActiveAmountWithGrowth(items, month, annualGrowthRate, 0);
  return getActiveAmountWithGrowth(items, month, annualGrowthRate, 0)
    + delta * getActiveAmountWithGrowth(items.filter(isGrossUppable), month, annualGrowthRate, 0);
}
