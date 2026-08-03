import { describe, it, expect } from 'vitest';
import { clampToRange } from './clampToRange';

describe('clampToRange', () => {
  it('raises a value below the minimum', () => {
    expect(clampToRange(10, 50, 100)).toBe(50);
  });

  it('lowers a value above the maximum', () => {
    expect(clampToRange(150, 50, 100)).toBe(100);
  });

  it('leaves a value inside the range untouched', () => {
    expect(clampToRange(75, 50, 100)).toBe(75);
  });

  it('treats both bounds as inclusive', () => {
    expect(clampToRange(50, 50, 100)).toBe(50);
    expect(clampToRange(100, 50, 100)).toBe(100);
  });

  it('enforces the down payment invariant', () => {
    // A $400k deposit against a $300k property must come back as $300k, never
    // a negative loan amount.
    expect(clampToRange(400000, 0, 300000)).toBe(300000);
  });

  it('leaves the lower side unbounded when min is undefined', () => {
    expect(clampToRange(-500, undefined, 100)).toBe(-500);
  });

  it('leaves the upper side unbounded when max is undefined', () => {
    expect(clampToRange(999999, 0, undefined)).toBe(999999);
  });

  it('falls back to the minimum for a non-finite value', () => {
    expect(clampToRange(NaN, 50, 100)).toBe(50);
    expect(clampToRange(Infinity, 50, 100)).toBe(50);
  });

  it('falls back to 0 for a non-finite value with no minimum', () => {
    expect(clampToRange(NaN, undefined, 100)).toBe(0);
  });
});
