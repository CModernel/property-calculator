import { describe, it, expect } from 'vitest';
import { classifyLvr, LVR_BANDS } from './classifyLvr';

describe('classifyLvr', () => {
  it('is "High risk, low equity" (red) at exactly 90 (inclusive boundary)', () => {
    expect(classifyLvr(90).summary).toBe('High risk, low equity');
    expect(classifyLvr(90).symbol).toBe('🔴');
  });

  it('is "High risk, low equity" (red) at 100', () => {
    expect(classifyLvr(100).summary).toBe('High risk, low equity');
  });

  it('is "High risk, low equity" (red) above 100 (no upper cap)', () => {
    expect(classifyLvr(120).summary).toBe('High risk, low equity');
  });

  it('is "Acceptable, limited flexibility" just below 90', () => {
    expect(classifyLvr(89.9).summary).toBe('Acceptable, limited flexibility');
  });

  it('is "Acceptable, limited flexibility" (orange) at exactly 80 (inclusive boundary)', () => {
    expect(classifyLvr(80).summary).toBe('Acceptable, limited flexibility');
    expect(classifyLvr(80).symbol).toBe('🟠');
  });

  it('is "Balanced, good position" just below 80', () => {
    expect(classifyLvr(79.9).summary).toBe('Balanced, good position');
  });

  it('is "Balanced, good position" (green) at exactly 70 (inclusive boundary)', () => {
    expect(classifyLvr(70).summary).toBe('Balanced, good position');
    expect(classifyLvr(70).symbol).toBe('🟢');
  });

  it('is "Strong, excellent flexibility" just below 70', () => {
    expect(classifyLvr(69.9).summary).toBe('Strong, excellent flexibility');
  });

  it('is "Strong, excellent flexibility" (green) at exactly 60 (inclusive boundary)', () => {
    expect(classifyLvr(60).summary).toBe('Strong, excellent flexibility');
    expect(classifyLvr(60).symbol).toBe('🟢');
  });

  it('is "Very safe, maximum flexibility" (blue) just below 60', () => {
    expect(classifyLvr(59.9).summary).toBe('Very safe, maximum flexibility');
    expect(classifyLvr(59.9).symbol).toBe('🔵');
  });

  it('is "Very safe, maximum flexibility" (blue) at 0 (safePercentage fallback / no loan)', () => {
    expect(classifyLvr(0).summary).toBe('Very safe, maximum flexibility');
    expect(classifyLvr(0).symbol).toBe('🔵');
  });

  it('is "Very safe, maximum flexibility" (blue) for a negative lvr (defensive/degenerate input)', () => {
    expect(classifyLvr(-10).symbol).toBe('🔵');
  });

  it('returns the same object reference as the corresponding LVR_BANDS entry (for tooltip highlight)', () => {
    expect(classifyLvr(85)).toBe(LVR_BANDS.find((b) => b.band === '80–90%'));
  });
});
