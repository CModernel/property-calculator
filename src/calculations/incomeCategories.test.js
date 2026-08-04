import { describe, it, expect } from 'vitest';
import { INCOME_CATEGORIES, INCOME_CATEGORY_DEFAULTS } from './incomeCategories';
import { MAX_MONTH } from './recurringAmount';

describe('INCOME_CATEGORY_DEFAULTS', () => {
  it('only defines defaults for categories that exist in INCOME_CATEGORIES', () => {
    for (const category of Object.keys(INCOME_CATEGORY_DEFAULTS)) {
      expect(INCOME_CATEGORIES).toContain(category);
    }
  });

  it('never overrides Tenants or Other - they keep the form\'s own baseline', () => {
    expect(INCOME_CATEGORY_DEFAULTS.Tenants).toBeUndefined();
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
