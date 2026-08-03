import { describe, it, expect } from 'vitest';
import { getNextSuggestion } from './suggestions';

describe('getNextSuggestion', () => {
  it('suggests month 1 for an empty list', () => {
    expect(getNextSuggestion([])).toBe(1);
  });

  it('suggests max month + 1 for an unsorted list', () => {
    expect(getNextSuggestion([{ month: 3 }, { month: 1 }])).toBe(4);
  });

  it('suggests element.month + 1 for a single-element list', () => {
    expect(getNextSuggestion([{ month: 7 }])).toBe(8);
  });
});
