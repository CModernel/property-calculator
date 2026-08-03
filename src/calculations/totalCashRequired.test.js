import { describe, it, expect } from 'vitest';
import { calculateTotalCashRequired } from './totalCashRequired';

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
});
