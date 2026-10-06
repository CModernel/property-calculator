import { describe, it, expect } from 'vitest';
import { toWeeklyEquivalent, isPerPaymentIncome, incomeAmountUnit } from './incomeDenomination';

// TODO-185: monthly income is entered per week; quarterly, yearly and one-time
// income is entered per payment. Every downstream formula works in weekly
// units (x52/12 to monthly, x52 to annual), so per-payment amounts are turned
// into the weekly figure that x52/12 maps straight back to the payment.
const item = (recurrence, extra = {}) => ({ id: 1, name: 'Dividends', amount: 1200, startMonth: 1, recurrence, endMonth: 360, ...extra });

describe('isPerPaymentIncome', () => {
  it('is false only for monthly income', () => {
    expect(isPerPaymentIncome(item('monthly'))).toBe(false);
    expect(isPerPaymentIncome(item('quarterly'))).toBe(true);
    expect(isPerPaymentIncome(item('yearly'))).toBe(true);
    expect(isPerPaymentIncome(item('none'))).toBe(true);
  });
});

describe('toWeeklyEquivalent', () => {
  it.each(['quarterly', 'yearly', 'none'])('scales a %s payment so x52/12 gives it back', (recurrence) => {
    const [converted] = toWeeklyEquivalent([item(recurrence)]);
    expect(converted.amount).toBeCloseTo(1200 * 12 / 52, 10);
    expect(converted.amount * 52 / 12).toBeCloseTo(1200, 10);
  });

  it('passes monthly (weekly-denominated) income through untouched', () => {
    const monthly = item('monthly');
    expect(toWeeklyEquivalent([monthly])[0]).toBe(monthly);
  });

  it('scales a tenant entry\'s per-person amount too', () => {
    const [converted] = toWeeklyEquivalent([item('yearly', { name: 'Room Rent', isShared: true, numPeople: 2, amountPerPerson: 600 })]);
    expect(converted.amountPerPerson).toBeCloseTo(600 * 12 / 52, 10);
  });

  it('never mutates the input', () => {
    const input = [item('quarterly')];
    toWeeklyEquivalent(input);
    expect(input[0].amount).toBe(1200);
  });
});

describe('incomeAmountUnit', () => {
  it('labels monthly income per week and everything else per payment', () => {
    expect(incomeAmountUnit(item('monthly'))).toBe('/week');
    expect(incomeAmountUnit(item('quarterly'))).toBe(' per quarter');
    expect(incomeAmountUnit(item('yearly'))).toBe(' per year');
    expect(incomeAmountUnit(item('none'))).toBe(' one-time');
  });
});
