import { describe, it, expect } from 'vitest';
import { formatMonthsDetailed, formatCompactMoney } from './formatting';

describe('formatCompactMoney', () => {
  it('abbreviates millions', () => {
    expect(formatCompactMoney(3000000)).toBe('3M');
    expect(formatCompactMoney(1500000)).toBe('1.5M');
  });

  it('abbreviates thousands', () => {
    expect(formatCompactMoney(200000)).toBe('200k');
    expect(formatCompactMoney(1000)).toBe('1k');
  });

  it('leaves values under a thousand alone', () => {
    expect(formatCompactMoney(0)).toBe('0');
    expect(formatCompactMoney(600)).toBe('600');
  });

  it('drops trailing zeros rather than padding decimals', () => {
    expect(formatCompactMoney(2000000)).toBe('2M');
    expect(formatCompactMoney(12000)).toBe('12k');
  });

  it('handles negatives', () => {
    expect(formatCompactMoney(-5000)).toBe('-5k');
  });

  it('does not abbreviate a value just under 1,000', () => {
    expect(formatCompactMoney(999)).toBe('999');
  });

  it('documents the current rounding quirk just under 1,000,000 - toFixed(1) rounds 999.999k up to "1000k" rather than switching to the M format', () => {
    expect(formatCompactMoney(999999)).toBe('1000k');
  });
});

describe('formatMonthsDetailed', () => {
  it('formats 0 months', () => {
    expect(formatMonthsDetailed(0)).toEqual({
      decimal: '0.0',
      technical: 0,
      human: '0 years'
    });
  });

  it('formats 12 months as a singular whole year', () => {
    expect(formatMonthsDetailed(12)).toEqual({
      decimal: '1.0',
      technical: 12,
      human: '1 year'
    });
  });

  it('formats 18 months as year + plural months remainder', () => {
    expect(formatMonthsDetailed(18)).toEqual({
      decimal: '1.5',
      technical: 18,
      human: '1 year 6 months'
    });
  });

  it('formats 24 months as plural whole years, no remainder suffix', () => {
    expect(formatMonthsDetailed(24)).toEqual({
      decimal: '2.0',
      technical: 24,
      human: '2 years'
    });
  });

  it('formats 13 months with a singular remainder month', () => {
    expect(formatMonthsDetailed(13)).toEqual({
      decimal: '1.1',
      technical: 13,
      human: '1 year 1 month'
    });
  });

  it('formats a "0 whole years + plural remainder months" case', () => {
    expect(formatMonthsDetailed(6)).toEqual({
      decimal: '0.5',
      technical: 6,
      human: '0 years 6 months'
    });
  });

  it('handles a non-integer months value', () => {
    const result = formatMonthsDetailed(18.5);
    expect(result.decimal).toBe('1.5');
    expect(result.technical).toBe(18.5);
    expect(result.human).toBe('1 year 6.5 months');
  });
});
