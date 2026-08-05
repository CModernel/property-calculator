import { MAX_MONTH } from './recurringAmount';

// The categories offered by the Income Name picklist, in display order.
// "House Rent" keeps its own dedicated Shared Room sub-form (see App.jsx) -
// named this way rather than "Tenants" since it covers both a shared room
// and the whole property let to one tenant, and "Tenants" read as
// room-renters only (TODO-46). "Other" reveals a free-text name field -
// neither needs a schedule default below beyond the form's own baseline
// ("Monthly, Forever").
export const INCOME_CATEGORIES = [
  'Salary/Wages',
  'Self-Employment',
  'Freelance/Contracting',
  'Business Income',
  'Dividends',
  'Interest',
  'Government Benefits',
  'Pension',
  'Child Support',
  'Bonus',
  'Commission',
  'Tax Refund',
  'Gift',
  'House Rent',
  'Other',
];

// Default Schedule applied when a category is picked in the Income Name
// dropdown, so the form reflects how that income naturally recurs instead of
// always defaulting the same way. Categories omitted here (House Rent,
// Other) keep whatever the form's current Schedule fields already are.
// Dividends defaults to "quarterly" as the closest supported recurrence -
// the model only has monthly/quarterly/yearly, no half-yearly.
// Child Support deliberately has no `endMonth` - unlike every other
// recurring category, its real-world duration has no universal default
// (until a set age, a custody change, etc.), so the form leaves whatever End
// Month value is already on the slider instead of nudging it to "Forever".
export const INCOME_CATEGORY_DEFAULTS = {
  'Salary/Wages': { oneTime: false, recurrence: 'monthly', endMonth: MAX_MONTH },
  'Self-Employment': { oneTime: false, recurrence: 'monthly', endMonth: MAX_MONTH },
  'Business Income': { oneTime: false, recurrence: 'monthly', endMonth: MAX_MONTH },
  Interest: { oneTime: false, recurrence: 'monthly', endMonth: MAX_MONTH },
  'Government Benefits': { oneTime: false, recurrence: 'monthly', endMonth: MAX_MONTH },
  Pension: { oneTime: false, recurrence: 'monthly', endMonth: MAX_MONTH },
  Commission: { oneTime: false, recurrence: 'monthly', endMonth: MAX_MONTH },
  'Freelance/Contracting': { oneTime: true },
  Bonus: { oneTime: true },
  'Tax Refund': { oneTime: true },
  Gift: { oneTime: true },
  Dividends: { oneTime: false, recurrence: 'quarterly', endMonth: MAX_MONTH },
  'Child Support': { oneTime: false, recurrence: 'monthly' },
};
