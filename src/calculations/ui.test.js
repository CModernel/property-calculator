import { describe, it, expect } from 'vitest';
import { getBalanceColor, getBalanceBgColor } from './ui';

describe('getBalanceColor', () => {
  it('is green at exactly 300 (inclusive boundary)', () => {
    expect(getBalanceColor(300)).toBe('text-green-600');
  });

  it('is yellow just below 300', () => {
    expect(getBalanceColor(299)).toBe('text-yellow-600');
  });

  it('is yellow at exactly 0 (inclusive boundary)', () => {
    expect(getBalanceColor(0)).toBe('text-yellow-600');
  });

  it('is red below 0', () => {
    expect(getBalanceColor(-1)).toBe('text-red-600');
  });
});

describe('getBalanceBgColor', () => {
  it('is green at exactly 300 (inclusive boundary)', () => {
    expect(getBalanceBgColor(300)).toBe('bg-green-50 border-green-300');
  });

  it('is yellow just below 300', () => {
    expect(getBalanceBgColor(299)).toBe('bg-yellow-50 border-yellow-300');
  });

  it('is yellow at exactly 0 (inclusive boundary)', () => {
    expect(getBalanceBgColor(0)).toBe('bg-yellow-50 border-yellow-300');
  });

  it('is red below 0', () => {
    expect(getBalanceBgColor(-1)).toBe('bg-red-50 border-red-300');
  });
});
