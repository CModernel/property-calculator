import { describe, it, expect } from 'vitest';
import { calculateTotalCashRequired, calculateCashRemaining, calculateLiquidSavings } from './totalCashRequired';

describe('calculateTotalCashRequired', () => {
  it('sums deposit, stamp duty and closing costs when LMI is not paid upfront', () => {
    expect(
      calculateTotalCashRequired({
        downPayment: 250000,
        stampDuty: 19593.5,
        closingCostsSubtotal: 4750,
        lmi: 12000,
        payLmiUpfront: false,
      })
    ).toBeCloseTo(250000 + 19593.5 + 4750, 5);
  });

  it('adds LMI in when the user opts to pay it upfront', () => {
    expect(
      calculateTotalCashRequired({
        downPayment: 50000,
        stampDuty: 16687,
        closingCostsSubtotal: 4750,
        lmi: 12375,
        payLmiUpfront: true,
      })
    ).toBeCloseTo(50000 + 16687 + 4750 + 12375, 5);
  });

  it('matches the worked example from the NSW cost model', () => {
    // $900k FHB purchase, $250k deposit, $19,593.50 stamp duty, $4,750 closing
    // costs, LVR 72% so no LMI at all.
    expect(
      calculateTotalCashRequired({
        downPayment: 250000,
        stampDuty: 19593.5,
        closingCostsSubtotal: 4750,
        lmi: 0,
        payLmiUpfront: false,
      })
    ).toBeCloseTo(274343.5, 5);
  });

  it('adds the foreign purchaser surcharge when present, defaulting to 0 when omitted', () => {
    expect(
      calculateTotalCashRequired({
        downPayment: 250000,
        stampDuty: 19593.5,
        foreignPurchaserSurcharge: 72000,
        closingCostsSubtotal: 4750,
        lmi: 0,
        payLmiUpfront: false,
      })
    ).toBeCloseTo(274343.5 + 72000, 5);
  });
});

describe('calculateCashRemaining', () => {
  it('matches the plain savings-minus-costs figure when nothing is scheduled', () => {
    expect(
      calculateCashRemaining({ totalSavings: 350000, totalCashRequired: 274343.5, totalScheduledOffset: 0 })
    ).toBeCloseTo(75656.5, 5);
  });

  it('also subtracts scheduled offset contributions, since they draw from the same pool', () => {
    expect(
      calculateCashRemaining({ totalSavings: 350000, totalCashRequired: 274343.5, totalScheduledOffset: 100000 })
    ).toBeCloseTo(-24343.5, 5);
  });

  it('goes negative when the deposit, upfront costs and scheduled contributions overcommit the savings', () => {
    expect(
      calculateCashRemaining({ totalSavings: 350000, totalCashRequired: 307000, totalScheduledOffset: 250000 })
    ).toBe(350000 - 307000 - 250000);
  });
});

describe('calculateLiquidSavings', () => {
  it('is savings minus the upfront costs', () => {
    expect(
      calculateLiquidSavings({ totalSavings: 350000, totalCashRequired: 274343.5 })
    ).toBeCloseTo(75656.5, 5);
  });

  // The whole point of this figure existing separately from cashRemaining:
  // money moved into the offset is still the buyer's and still reachable, so
  // committing it must not shrink the Emergency/Vacancy Buffer.
  it('does not shrink when cash is committed to the offset, unlike cashRemaining', () => {
    const totalSavings = 350000;
    const totalCashRequired = 307000;
    const withoutContribution = calculateLiquidSavings({ totalSavings, totalCashRequired });

    expect(calculateLiquidSavings({ totalSavings, totalCashRequired })).toBe(withoutContribution);
    expect(
      calculateCashRemaining({ totalSavings, totalCashRequired, totalScheduledOffset: 10000 })
    ).toBe(withoutContribution - 10000);
  });

  it('goes negative when the upfront costs alone exceed the savings', () => {
    expect(
      calculateLiquidSavings({ totalSavings: 100000, totalCashRequired: 274343.5 })
    ).toBeCloseTo(-174343.5, 5);
  });
});
