import { describe, it, expect } from 'vitest';
import { calculateMonthlyRate, calculateMonthlyPayment } from './loan';
import {
  classifyByBands,
  calculateEmergencyBufferMonths, classifyEmergencyBuffer,
  calculateHousingCostRatio, classifyHousingCostRatio,
  calculateStressTestSurvivedDelta, classifyStressTest,
  calculateUpfrontCostRatio, classifyUpfrontCostRatio,
  classifyGearing,
  calculateVacancyBufferMonths, classifyVacancyBuffer,
  calculateRentalYield, hasEnoughDataForRentalYield, classifyRentalYield,
  calculateMortgageFreeAge, classifyMortgageFreeAge,
  calculateOffsetUtilisation, classifyOffsetUtilisation,
} from './purchaseHealthCheck';

describe('classifyByBands', () => {
  const bands = [
    { min: 10, label: 'high' },
    { min: 5, label: 'mid' },
    { min: -Infinity, label: 'low' },
  ];

  it('picks the highest band the value clears', () => {
    expect(classifyByBands(12, bands).label).toBe('high');
    expect(classifyByBands(10, bands).label).toBe('high');
    expect(classifyByBands(7, bands).label).toBe('mid');
    expect(classifyByBands(1, bands).label).toBe('low');
    expect(classifyByBands(-100, bands).label).toBe('low');
  });
});

describe('Emergency Buffer', () => {
  it('divides Remaining Savings by total monthly outgoings', () => {
    expect(calculateEmergencyBufferMonths(6000, 2000)).toBe(3);
  });

  it('is Infinity when there are no monthly outgoings at all', () => {
    expect(calculateEmergencyBufferMonths(6000, 0)).toBe(Infinity);
  });

  it('classifies at the documented boundaries (>=12 excellent, >=6 good, >=3 moderate, else high risk)', () => {
    expect(classifyEmergencyBuffer(12).label).toBe('Excellent');
    expect(classifyEmergencyBuffer(6).label).toBe('Good');
    expect(classifyEmergencyBuffer(3).label).toBe('Moderate');
    expect(classifyEmergencyBuffer(2.9).label).toBe('High risk');
    expect(classifyEmergencyBuffer(2.9).critical).toBe(true);
  });
});

describe('Housing Cost Ratio', () => {
  it('is total property cost as a % of total monthly income', () => {
    expect(calculateHousingCostRatio(2000, 8000)).toBe(25);
  });

  it('is Infinity (not NaN) when there is no income at all - infinitely unaffordable, not a divide-by-zero glitch', () => {
    expect(calculateHousingCostRatio(2000, 0)).toBe(Infinity);
  });

  it('classifies at the documented boundaries (>=50 high risk, >=40 caution, >=30 good, else excellent)', () => {
    expect(classifyHousingCostRatio(50).label).toBe('High risk');
    expect(classifyHousingCostRatio(50).critical).toBe(true);
    expect(classifyHousingCostRatio(40).label).toBe('Caution');
    expect(classifyHousingCostRatio(30).label).toBe('Good');
    expect(classifyHousingCostRatio(29.9).label).toBe('Excellent');
  });
});

describe('Interest Rate Stress Test', () => {
  const loanAmount = 300000;
  const totalMonths = 360;
  const interestRate = 5;

  it('survives all the way to +3 when there is ample surplus', () => {
    const paymentAt8 = calculateMonthlyPayment(loanAmount, calculateMonthlyRate(interestRate + 3), totalMonths);
    const survivedDelta = calculateStressTestSurvivedDelta({
      loanAmount, interestRate, totalMonths, monthlyPropertyExpenses: 0,
      monthlyIncome: paymentAt8 + 1000, monthlyRentalIncome: 0, monthlyPersonalExpenses: 0,
    });
    expect(survivedDelta).toBe(3);
    expect(classifyStressTest(survivedDelta).label).toBe('Excellent');
  });

  it('survives +1 but not +2 when the surplus is thin past that point', () => {
    const paymentAt6 = calculateMonthlyPayment(loanAmount, calculateMonthlyRate(interestRate + 1), totalMonths);
    const paymentAt7 = calculateMonthlyPayment(loanAmount, calculateMonthlyRate(interestRate + 2), totalMonths);
    const survivedDelta = calculateStressTestSurvivedDelta({
      loanAmount, interestRate, totalMonths, monthlyPropertyExpenses: 0,
      monthlyIncome: (paymentAt6 + paymentAt7) / 2, monthlyRentalIncome: 0, monthlyPersonalExpenses: 0,
    });
    expect(survivedDelta).toBe(1);
    expect(classifyStressTest(survivedDelta).label).toBe('Moderate');
  });

  it('fails already at +1, reporting 0', () => {
    const paymentAt6 = calculateMonthlyPayment(loanAmount, calculateMonthlyRate(interestRate + 1), totalMonths);
    const survivedDelta = calculateStressTestSurvivedDelta({
      loanAmount, interestRate, totalMonths, monthlyPropertyExpenses: 0,
      monthlyIncome: paymentAt6 - 100, monthlyRentalIncome: 0, monthlyPersonalExpenses: 0,
    });
    expect(survivedDelta).toBe(0);
    expect(classifyStressTest(survivedDelta).label).toBe('High risk');
    expect(classifyStressTest(survivedDelta).critical).toBe(true);
  });
});

describe('Upfront Cost Ratio', () => {
  it('excludes the deposit itself, only counting fees/closing costs/LMI', () => {
    // $850k price, $307k deposit, $30k in fees -> 30000/850000 = 3.53%
    expect(calculateUpfrontCostRatio(337000, 307000, 850000)).toBeCloseTo(3.529, 2);
  });

  it('classifies at the documented boundaries (>=4 high, >=2 normal, else excellent)', () => {
    expect(classifyUpfrontCostRatio(4).label).toBe('High');
    expect(classifyUpfrontCostRatio(2).label).toBe('Normal');
    expect(classifyUpfrontCostRatio(1.9).label).toBe('Excellent');
  });
});

describe('Gearing (TODO-69)', () => {
  it('is positive gearing when the property cash flow is non-negative', () => {
    expect(classifyGearing(0).label).toBe('Positive gearing');
    expect(classifyGearing(500).label).toBe('Positive gearing');
  });

  it('is negative gearing when the property cash flow is negative', () => {
    expect(classifyGearing(-1).label).toBe('Negative gearing');
  });
});

describe('Vacancy Buffer (TODO-69)', () => {
  it('divides Remaining Savings by the property-only monthly cost', () => {
    expect(calculateVacancyBufferMonths(12000, 2000)).toBe(6);
  });

  it('classifies at the documented boundaries (>=6 excellent, >=3 good, else high risk)', () => {
    expect(classifyVacancyBuffer(6).label).toBe('Excellent');
    expect(classifyVacancyBuffer(3).label).toBe('Good');
    expect(classifyVacancyBuffer(2.9).label).toBe('High risk');
    expect(classifyVacancyBuffer(2.9).critical).toBe(true);
  });
});

describe('Rental Yield (TODO-69)', () => {
  it('annualizes weekly rental income as a % of property price', () => {
    // $500/week * 52 = $26,000/yr, on an $850k property = 3.06%
    expect(calculateRentalYield(500, 850000)).toBeCloseTo(3.06, 1);
  });

  it('flags insufficient data when there is no rental income entered at all', () => {
    expect(hasEnoughDataForRentalYield(0)).toBe(false);
    expect(hasEnoughDataForRentalYield(1)).toBe(true);
  });

  it('classifies at the documented boundaries (>=5 strong, >=3 average, else weak)', () => {
    expect(classifyRentalYield(5).label).toBe('Strong');
    expect(classifyRentalYield(3).label).toBe('Average');
    expect(classifyRentalYield(2.9).label).toBe('Weak');
  });
});

describe('Mortgage-Free Age (TODO-70)', () => {
  it('adds the current age to the loan simulation years', () => {
    expect(calculateMortgageFreeAge(35, 25)).toBe(60);
  });

  it('classifies at the documented boundaries (>=70 late, >=67 cutting it close, >=60 reasonable, else early)', () => {
    expect(classifyMortgageFreeAge(70).label).toBe('Late');
    expect(classifyMortgageFreeAge(67).label).toBe('Cutting it close');
    expect(classifyMortgageFreeAge(60).label).toBe('Reasonable');
    expect(classifyMortgageFreeAge(59.9).label).toBe('Early');
  });
});

describe('Offset Utilisation (TODO-70)', () => {
  it('is offset as a % of (offset + remaining balance)', () => {
    expect(calculateOffsetUtilisation(50000, 450000)).toBe(10);
  });

  it('is 100% (not NaN) once the loan is fully paid off', () => {
    expect(calculateOffsetUtilisation(0, 0)).toBe(100);
  });

  it('classifies at the documented boundaries (>=20 strong, >=10 building, >=5 early days, else just started)', () => {
    expect(classifyOffsetUtilisation(20).label).toBe('Strong');
    expect(classifyOffsetUtilisation(10).label).toBe('Building');
    expect(classifyOffsetUtilisation(5).label).toBe('Early days');
    expect(classifyOffsetUtilisation(4.9).label).toBe('Just started');
  });
});
