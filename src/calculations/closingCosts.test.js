import { describe, it, expect } from 'vitest';
import { sumClosingCosts } from './closingCosts';

// NSW's own defaultClosingCosts summing to $4,750 is asserted in
// src/calculations/states/nsw.test.js now (TODO-58).
describe('sumClosingCosts', () => {
  it('adds a list of cost values', () => {
    expect(sumClosingCosts([2000, 700, 350])).toBe(3050);
  });

  it('returns 0 for an empty list', () => {
    expect(sumClosingCosts([])).toBe(0);
  });

  it('treats non-finite entries as 0 instead of poisoning the sum', () => {
    // A field mid-edit (e.g. NumberSliderField's draft state) should never be
    // able to turn the subtotal into NaN.
    expect(sumClosingCosts([100, NaN, 200])).toBe(300);
    expect(sumClosingCosts([100, undefined, 200])).toBe(300);
  });
});
