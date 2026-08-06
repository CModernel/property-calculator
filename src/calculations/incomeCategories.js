import { MAX_MONTH } from './recurringAmount';

// The categories offered by the Income Name picklist, in display order.
// "House Rent" (TODO-56) is a plain flat weekly amount - the entire property
// let to one tenant/family for one weekly figure, no shared/room fields at
// all. "Room Rent" keeps the dedicated Shared Room sub-form (see App.jsx) -
// renting out a single room, optionally split between multiple people. The
// two used to be bundled into one "House Rent" category (TODO-46 renamed
// "Tenants" to "House Rent" to cover both cases), split apart here since a
// whole-property rental and a room rental are different concepts. "Other"
// reveals a free-text name field - none of these three need a schedule
// default below beyond the form's own baseline ("Monthly, Forever").
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
  'Room Rent',
  'Other',
];

// Both categories count toward "Rental Income" (see weeklyRentalIncome/
// weeklyIncome, src/App.jsx) - checked against `income.name`, which stores
// the category verbatim for every category except 'Other'.
export const RENTAL_INCOME_CATEGORIES = ['House Rent', 'Room Rent'];

// TODO-90: which income sources Salary Growth applies to - deliberately
// narrow (not "all personal income") so this task stays a tight,
// accurately-named feature, distinct from Rent Growth (TODO-91) and any
// future investment-return growth.
export const SALARY_INCOME_CATEGORY = 'Salary/Wages';

// Default Schedule applied when a category is picked in the Income Name
// dropdown, so the form reflects how that income naturally recurs instead of
// always defaulting the same way. Categories omitted here (House Rent, Room
// Rent, Other) keep whatever the form's current Schedule fields already are.
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
