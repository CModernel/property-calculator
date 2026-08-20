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

// TODO-151: which categories a net-entered amount can be grossed UP from, for
// the two indicators whose bands cite an externally-defined pre-tax benchmark
// (Housing Cost Ratio, Rental Yield - see src/calculations/grossIncome.js).
// This is the FIRST place a category affects tax treatment in this app -
// everywhere else, tax is keyed purely off the per-item `isGross` boolean.
//
// The test is NOT "is this income taxable". It is "would a net-entered figure
// here hide a larger gross one worth recovering", which holds in two cases:
//  1. Tax is WITHHELD AT SOURCE. Salary/Wages, Bonus and Commission are paid
//     through payroll with PAYG withheld, so take-home $1,614 really does sit
//     behind a gross $2,017. Dividing recovers a real number.
//  2. No withholding, but the user plausibly enters a post-tax figure anyway.
//     The self-employment trio qualifies: someone running a business pays
//     quarterly instalments rather than having tax withheld, but naturally
//     thinks in terms of what they pay themselves, which may well be net.
// Everything else fails both tests, so grossing it up would invent money:
//  - House Rent / Room Rent have no withholding AND no "take-home" reading:
//    the tenant pays $600 and the landlord receives $600, with tax settled
//    later via the return. Dividing would invent $150/week of rent nobody ever
//    paid - and rental yield is defined as rent over price, where rent is an
//    observable market figure. Lender serviceability likewise assesses the
//    actual (shaded) rent.
//  - Dividends and Interest are the same shape (excluded on review of
//    PCALC-100): a resident quoting a TFN has nothing withheld, and there is no
//    "take-home dividend" - the amount received already IS the gross.
//
// Deliberately a WHITELIST, which errs strict in two further ways on purpose:
//  - a category added to the picklist later defaults to non-taxable, so it
//    can't be silently inflated by a future edit;
//  - an 'Other' item stores free text in `name` (App.jsx's addIncomeSource),
//    never a category constant, so it never matches. This is the same
//    mechanism RENTAL_INCOME_CATEGORIES already relies on.
// Erring strict matters because grossing up income that hides no larger gross
// figure FABRICATES income, which makes a risk indicator read too optimistic -
// the dangerous direction, and worst for the users with the least margin.
// `incomeCategories.test.js` pins the membership, the disjointness from
// RENTAL_INCOME_CATEGORIES that grossIncome.js relies on, and a guard that
// fails when a new picklist category is classified in neither bucket.
//
// Also excluded, and why: Government Benefits and Child Support are largely
// not assessable income; a Tax Refund is a return of tax already paid, not
// income; a Gift isn't taxed; and Pension is genuinely ambiguous (an Australian
// super pension is tax-free after 60, and the Age Pension usually sits under
// the effective threshold once SAPTO applies). Anyone affected has the app's
// existing escape hatch: enter the pre-tax figure and tick "Gross (pre-tax)",
// which counts it at face value here AND nets it correctly for cash flow.
export const TAXABLE_INCOME_CATEGORIES = [
  'Salary/Wages',
  'Bonus',
  'Commission',
  'Self-Employment',
  'Freelance/Contracting',
  'Business Income',
];

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
