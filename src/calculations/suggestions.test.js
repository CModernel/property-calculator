import { describe, it, expect } from 'vitest';
import { getNextSuggestion } from './suggestions';

describe('getNextSuggestion', () => {
  it('suggests month 1 for an empty list', () => {
    expect(getNextSuggestion([])).toBe(1);
  });

  it('suggests max startMonth + 1 for an unsorted list', () => {
    expect(getNextSuggestion([{ startMonth: 3 }, { startMonth: 1 }])).toBe(4);
  });

  it('suggests element.startMonth + 1 for a single-element list', () => {
    expect(getNextSuggestion([{ startMonth: 7 }])).toBe(8);
  });
});
