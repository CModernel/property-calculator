import { describe, it, expect } from 'vitest';
import { getGrossActiveAmount, getGrossActiveAmountWithGrowth, calculateGrossUpFactor, isGrossUppable } from './grossIncome';
import { getActiveAmount } from './recurringAmount';
import { calculateCompoundedValue } from './growthRate';

// TODO-151: the before-tax reconstruction behind Housing Cost Ratio's 30/40/50
// bands and Rental Yield's 3%/5% bands, both of which are defined on pre-tax
// income. Three groups get three different treatments - see grossIncome.js.

const forever = { startMonth: 1, recurrence: 'monthly', endMonth: 360 };
const item = (name, amount, extra = {}) => ({ id: name, name, amount, ...forever, ...extra });

describe('calculateGrossUpFactor', () => {
  it('is the reciprocal of the after-tax share', () => {
    expect(calculateGrossUpFactor(20)).toBeCloseTo(1.25, 10);
    expect(calculateGrossUpFactor(45)).toBeCloseTo(1 / 0.55, 10);
  });

  it('is exactly 1 at a 0% rate, so the gross-up delta vanishes', () => {
    expect(calculateGrossUpFactor(0) - 1).toBe(0);
  });

  // Not reachable via the slider (clamped [0, 90]) but reachable from a
  // hand-edited or stale saved scenario, which gets no validation. Without the
  // clamp the denominator is Infinity and Housing Cost Ratio reads 0% ->
  // "Excellent, plenty of headroom": falsely reassuring, the one direction this
  // indicator must never fail in.
  it.each([100, 150, -5])('is clamped to 1 at an out-of-range rate of %i', (rate) => {
    expect(calculateGrossUpFactor(rate)).toBe(1);
  });
});

describe('isGrossUppable', () => {
  it('is true only for a net-entered item in a taxable category', () => {
    expect(isGrossUppable(item('Salary/Wages', 800))).toBe(true);
    expect(isGrossUppable(item('Salary/Wages', 800, { isGross: true }))).toBe(false);
    expect(isGrossUppable(item('Government Benefits', 800))).toBe(false);
  });
});

describe('getGrossActiveAmount', () => {
  it('grosses up a net-entered taxable item by the flat rate', () => {
    expect(getGrossActiveAmount([item('Salary/Wages', 800)], 1, 20)).toBeCloseTo(1000, 10);
  });

  // The whole reason this isn't a single multiplier over the net total: for a
  // Gross-marked item the stored amount already IS the pre-tax figure, so
  // dividing again would inflate it a second time.
  it('takes an isGross-marked item at face value, never grossing it up twice', () => {
    expect(getGrossActiveAmount([item('Salary/Wages', 1000, { isGross: true })], 1, 20)).toBe(1000);
  });

  // The locked decision, stated as a test. Nothing was withheld from these, so
  // net IS gross - grossing them up would fabricate income and make a risk
  // indicator read optimistically for the users with the least margin.
  it.each(['Government Benefits', 'Child Support', 'Tax Refund', 'Gift', 'Pension', 'Dividends', 'Interest', 'House Rent', 'Room Rent'])(
    'leaves %s untouched - nothing was withheld from it, so there is no gross to recover',
    (name) => {
      expect(getGrossActiveAmount([item(name, 800)], 1, 20)).toBe(800);
    }
  );

  // An 'Other' item stores free text in `name` (App.jsx's addIncomeSource), so
  // it never matches the whitelist. Erring strict is deliberate, and it's the
  // same mechanism RENTAL_INCOME_CATEGORIES already relies on.
  it('leaves a free-text (Other) category untouched', () => {
    expect(getGrossActiveAmount([item('Side hustle money', 800)], 1, 20)).toBe(800);
  });

  // toBe, not toBeCloseTo: the delta form guarantees bitwise equality at 0%,
  // because the sum iterates the same array in the same order as the net path
  // and the delta term is exactly 0. A two-subset formulation could differ in
  // the last bit, since float addition isn't associative.
  it('is a BITWISE no-op at a 0% rate, whatever the mix of items', () => {
    const items = [
      item('Salary/Wages', 812.37),
      item('House Rent', 613.91, { isGross: true }),
      item('Government Benefits', 297.03),
      item('Whatever', 101.11),
      item('Dividends', 55.55),
    ];
    expect(getGrossActiveAmount(items, 1, 0)).toBe(getActiveAmount(items, 1, 0));
  });

  it('sums the three treatments together in one mixed portfolio', () => {
    const items = [
      item('Salary/Wages', 800),                          // grossed up -> 1000
      item('House Rent', 600),                            // face value -> 600 (no withholding)
      item('Child Support', 300),                         // face value -> 300
    ];
    expect(getGrossActiveAmount(items, 1, 20)).toBeCloseTo(1900, 10);
  });

  // Exercises both branches at once, and is the single easiest bug to
  // introduce here: a Gross-marked $1,000 and a net-entered $800 are the SAME
  // person's pay at a 20% rate, so both must report $1,000 before tax.
  it('agrees between a Gross-marked amount and the equivalent net-entered one', () => {
    const asGross = getGrossActiveAmount([item('Salary/Wages', 1000, { isGross: true })], 1, 20);
    const asNet = getGrossActiveAmount([item('Salary/Wages', 800)], 1, 20);
    expect(asNet).toBeCloseTo(asGross, 10);
  });

  it('respects each item\'s schedule, same as the net path', () => {
    const notStartedYet = [{ id: 1, name: 'Salary/Wages', amount: 800, startMonth: 24, recurrence: 'monthly', endMonth: 360 }];
    expect(getGrossActiveAmount(notStartedYet, 1, 20)).toBe(0);
    expect(getGrossActiveAmount(notStartedYet, 24, 20)).toBeCloseTo(1000, 10);
  });

  it('is 0 for an empty list rather than NaN', () => {
    expect(getGrossActiveAmount([], 1, 20)).toBe(0);
  });
});

describe('getGrossActiveAmountWithGrowth', () => {
  it('agrees with the plain helper when growth is 0', () => {
    const items = [item('Salary/Wages', 800), item('Gift', 200)];
    expect(getGrossActiveAmountWithGrowth(items, 13, 0, 20)).toBeCloseTo(getGrossActiveAmount(items, 13, 20), 10);
  });

  // The gross-up commutes with compounding: (f-1) * Sum(a*g) == Sum((f-1)*a*g).
  it('applies the growth multiplier to both the grossed-up and face-value groups', () => {
    const items = [item('Salary/Wages', 800), item('Gift', 200)];
    const multiplier = calculateCompoundedValue(1, 3, 13);
    expect(getGrossActiveAmountWithGrowth(items, 13, 3, 20)).toBeCloseTo((1000 + 200) * multiplier, 10);
  });

  it('is a BITWISE no-op at a 0% rate', () => {
    const items = [item('Salary/Wages', 812.37), item('Pension', 401.13)];
    expect(getGrossActiveAmountWithGrowth(items, 13, 3, 0)).toBe(getGrossActiveAmountWithGrowth(items, 13, 3, 0));
    expect(getGrossActiveAmountWithGrowth(items, 13, 3, 0)).toBeCloseTo(1213.5 * calculateCompoundedValue(1, 3, 13), 10);
  });
});
