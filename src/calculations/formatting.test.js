import { describe, it, expect } from 'vitest';
import { formatMonthsDetailed } from './formatting';

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
});
