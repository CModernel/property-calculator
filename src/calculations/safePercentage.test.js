import { describe, it, expect } from 'vitest';
import { safePercentage } from './safePercentage';

describe('safePercentage', () => {
  it('computes a normal percentage', () => {
    expect(safePercentage(250000, 500000)).toBe(50);
  });

  it('returns 0 by default when the denominator is zero', () => {
    // A 100% cash purchase leaves loanAmount at 0; the LVR should read 0%,
    // not Infinity%.
    expect(safePercentage(50000, 0)).toBe(0);
  });

  it('returns the caller-supplied fallback when the denominator is zero', () => {
    // Progress bars want the opposite reading: nothing owing means fully paid.
    expect(safePercentage(0, 0, 100)).toBe(100);
  });

  it('returns 0 for a zero numerator without hitting the fallback', () => {
    expect(safePercentage(0, 500000, 100)).toBe(0);
  });

  it('keeps a negative percentage negative', () => {
    expect(safePercentage(-50000, 500000)).toBe(-10);
  });

  it('falls back for non-finite inputs', () => {
    expect(safePercentage(NaN, 100)).toBe(0);
    expect(safePercentage(100, NaN)).toBe(0);
    expect(safePercentage(Infinity, 100, 100)).toBe(100);
  });
});
