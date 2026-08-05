import { describe, it, expect } from 'vitest';
import { INCOME_CATEGORIES, INCOME_CATEGORY_DEFAULTS, RENTAL_INCOME_CATEGORIES } from './incomeCategories';
import { MAX_MONTH } from './recurringAmount';

describe('INCOME_CATEGORY_DEFAULTS', () => {
  it('only defines defaults for categories that exist in INCOME_CATEGORIES', () => {
    for (const category of Object.keys(INCOME_CATEGORY_DEFAULTS)) {
      expect(INCOME_CATEGORIES).toContain(category);
    }
  });

  it('never overrides House Rent, Room Rent or Other - they keep the form\'s own baseline', () => {
    expect(INCOME_CATEGORY_DEFAULTS['House Rent']).toBeUndefined();
    expect(INCOME_CATEGORY_DEFAULTS['Room Rent']).toBeUndefined();
    expect(INCOME_CATEGORY_DEFAULTS.Other).toBeUndefined();
  });

  it('one-time categories define no recurrence or endMonth', () => {
    const oneTimeCategories = Object.entries(INCOME_CATEGORY_DEFAULTS).filter(([, d]) => d.oneTime);
    expect(oneTimeCategories.length).toBeGreaterThan(0);
    for (const [, defaults] of oneTimeCategories) {
      expect(defaults.recurrence).toBeUndefined();
      expect(defaults.endMonth).toBeUndefined();
    }
  });

  it('recurring categories use a supported recurrence value', () => {
    const recurringCategories = Object.entries(INCOME_CATEGORY_DEFAULTS).filter(([, d]) => !d.oneTime);
    expect(recurringCategories.length).toBeGreaterThan(0);
    for (const [, defaults] of recurringCategories) {
      expect(['monthly', 'quarterly', 'yearly']).toContain(defaults.recurrence);
    }
  });

  it('every recurring category except Child Support defaults endMonth to "Forever"', () => {
    for (const [category, defaults] of Object.entries(INCOME_CATEGORY_DEFAULTS)) {
      if (defaults.oneTime) continue;
      if (category === 'Child Support') {
        expect(defaults.endMonth).toBeUndefined();
      } else {
        expect(defaults.endMonth).toBe(MAX_MONTH);
      }
    }
  });

  it('defaults Dividends to quarterly, the closest supported recurrence', () => {
    expect(INCOME_CATEGORY_DEFAULTS.Dividends).toEqual({ oneTime: false, recurrence: 'quarterly', endMonth: MAX_MONTH });
  });
});

describe('RENTAL_INCOME_CATEGORIES', () => {
  it('contains exactly House Rent and Room Rent, both valid categories', () => {
    expect(RENTAL_INCOME_CATEGORIES).toEqual(['House Rent', 'Room Rent']);
    for (const category of RENTAL_INCOME_CATEGORIES) {
      expect(INCOME_CATEGORIES).toContain(category);
    }
  });
});
