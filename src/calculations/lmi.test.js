import { describe, it, expect } from 'vitest';
import { estimateLmi } from './lmi';

describe('estimateLmi', () => {
  it('is $0 at exactly 80% LVR (the trigger threshold is exclusive)', () => {
    expect(estimateLmi(400000, 80)).toBe(0);
  });

  it('is $0 below 80% LVR', () => {
    expect(estimateLmi(400000, 50)).toBe(0);
  });

  it('applies the 85% band rate just above 80%', () => {
    expect(estimateLmi(400000, 85)).toBeCloseTo(400000 * 0.014, 5);
  });

  it('applies the 90% band rate', () => {
    expect(estimateLmi(450000, 90)).toBeCloseTo(450000 * 0.0275, 5);
  });

  it('applies the 95% band rate', () => {
    expect(estimateLmi(475000, 95)).toBeCloseTo(475000 * 0.045, 5);
  });

  it('caps the rate for LVR above 95%', () => {
    expect(estimateLmi(495000, 99)).toBeCloseTo(495000 * 0.045, 5);
  });

  it('scales with loan amount at a fixed LVR', () => {
    expect(estimateLmi(900000, 90)).toBeCloseTo(900000 * 0.0275, 5);
  });
});
