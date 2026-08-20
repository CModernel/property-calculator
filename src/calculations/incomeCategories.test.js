import { describe, it, expect } from 'vitest';
import { INCOME_CATEGORIES, INCOME_CATEGORY_DEFAULTS, RENTAL_INCOME_CATEGORIES, SALARY_INCOME_CATEGORY, TAXABLE_INCOME_CATEGORIES } from './incomeCategories';
import { MAX_MONTH } from './recurringAmount';

describe('SALARY_INCOME_CATEGORY', () => {
  it('is "Salary/Wages" and is a member of INCOME_CATEGORIES', () => {
    expect(SALARY_INCOME_CATEGORY).toBe('Salary/Wages');
    expect(INCOME_CATEGORIES).toContain(SALARY_INCOME_CATEGORY);
  });
});

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

// TODO-151: which categories a net-entered amount can be grossed UP from, for
// the two indicators whose bands cite a pre-tax benchmark. Added on review of
// PCALC-100, which shipped the constant without a test.
describe('TAXABLE_INCOME_CATEGORIES', () => {
  // Everything here either has PAYG withheld at source, or is plausibly entered
  // post-tax by someone paying themselves from a business.
  const NOT_GROSSED_UP = [
    'Government Benefits', 'Pension', 'Child Support', 'Tax Refund', 'Gift',
    'Dividends', 'Interest', 'House Rent', 'Room Rent', 'Other',
  ];

  it('contains exactly the withheld-at-source and self-employment categories, all valid', () => {
    expect(TAXABLE_INCOME_CATEGORIES).toEqual([
      'Salary/Wages', 'Bonus', 'Commission',
      'Self-Employment', 'Freelance/Contracting', 'Business Income',
    ]);
    for (const category of TAXABLE_INCOME_CATEGORIES) {
      expect(INCOME_CATEGORIES).toContain(category);
    }
  });

  it('excludes every category that hides no larger gross figure', () => {
    for (const category of NOT_GROSSED_UP) {
      expect(TAXABLE_INCOME_CATEGORIES).not.toContain(category);
    }
  });

  // grossIncome.js relies on this: it passes `effectiveTaxRate` to the rental
  // bucket for shape-consistency with the non-rental one, which is only safe
  // because rent can never be grossed up. If the two lists ever overlapped,
  // rental income would start silently moving with the tax rate.
  it('is disjoint from RENTAL_INCOME_CATEGORIES', () => {
    for (const category of RENTAL_INCOME_CATEGORIES) {
      expect(TAXABLE_INCOME_CATEGORIES).not.toContain(category);
    }
  });

  // The guard that matters most: adding a category to the picklist must force an
  // explicit taxability decision. Without this a new category silently lands in
  // neither bucket and defaults to never-grossed-up, unnoticed.
  it('classifies every category in the picklist, so a new one cannot slip through unclassified', () => {
    const classified = [...TAXABLE_INCOME_CATEGORIES, ...NOT_GROSSED_UP];
    for (const category of INCOME_CATEGORIES) {
      expect(classified).toContain(category);
    }
    expect(classified).toHaveLength(INCOME_CATEGORIES.length);
  });
});
