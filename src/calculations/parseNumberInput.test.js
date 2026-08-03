import { describe, it, expect } from 'vitest';
import { parseNumberInput } from './parseNumberInput';

describe('parseNumberInput', () => {
  it('returns null for an empty string', () => {
    // Number('') is 0, which is exactly the bug this guards against: it would
    // snap a cleared field to 0 instead of leaving it empty while typing.
    expect(parseNumberInput('')).toBeNull();
  });

  it('returns null for whitespace only', () => {
    expect(parseNumberInput('   ')).toBeNull();
  });

  it('returns null for text that is not a number', () => {
    expect(parseNumberInput('abc')).toBeNull();
  });

  it('returns null for partial input a number field allows transiently', () => {
    expect(parseNumberInput('-')).toBeNull();
    expect(parseNumberInput('1.2.3')).toBeNull();
  });

  it('returns null for infinities', () => {
    expect(parseNumberInput('Infinity')).toBeNull();
    expect(parseNumberInput('-Infinity')).toBeNull();
  });

  it('preserves a real zero', () => {
    // 0 is a valid deposit (a fully financed purchase), so it must not be
    // conflated with "empty".
    expect(parseNumberInput('0')).toBe(0);
  });

  it('parses decimals', () => {
    expect(parseNumberInput('5.38')).toBe(5.38);
  });

  it('parses values with leading zeros and surrounding whitespace', () => {
    expect(parseNumberInput('007')).toBe(7);
    expect(parseNumberInput('  742500 ')).toBe(742500);
  });

  it('parses negative numbers', () => {
    expect(parseNumberInput('-250')).toBe(-250);
  });

  it('returns null for non-string input', () => {
    expect(parseNumberInput(null)).toBeNull();
    expect(parseNumberInput(undefined)).toBeNull();
    expect(parseNumberInput(500)).toBeNull();
  });
});
