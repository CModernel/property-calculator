import { describe, it, expect } from 'vitest';
import { STATES, getStateModule } from './index';
import nsw from './nsw';

describe('getStateModule', () => {
  it('returns the NSW module for "NSW"', () => {
    expect(getStateModule('NSW')).toBe(nsw);
  });

  it('falls back to NSW for an unrecognised code instead of throwing', () => {
    expect(getStateModule('XYZ')).toBe(nsw);
    expect(getStateModule(undefined)).toBe(nsw);
  });

  it('STATES contains exactly the currently-supported states', () => {
    expect(Object.keys(STATES)).toEqual(['NSW']);
  });
});
