import { formatCompactMoney } from '../calculations/formatting';

// TODO-135: the STATIC props of the six core purchase/loan fields, shared by
// both Advanced (their original call sites in App.jsx) and Simple mode, which
// re-renders the same six.
//
// Only the drift-prone half lives here - `value`, `onChange` and `children`
// stay at each call site, since those genuinely differ per mode. Copying
// min/max/sliderMin/sliderMax/step/impact/prefix into a second call site is
// exactly the duplication TODO-116 just removed elsewhere; one edit to a
// range must not need finding two places.
//
// `max`/`sliderMax` for Deposit Contribution and Loan Amount depend on
// propertyPrice at runtime, so those two are functions of it rather than flat
// objects - the alternative (leaving those two props at the call sites) is
// precisely the drift this module exists to prevent.

export const PROPERTY_PRICE_FIELD = {
  label: 'Property Price',
  min: 50000,
  max: 10000000,
  sliderMin: 200000,
  sliderMax: 3000000,
  step: 10000,
  impact: 'negative',
  prefix: '$',
  suffix: ' AUD',
  formatBound: formatCompactMoney,
};

export const depositContributionField = (propertyPrice) => ({
  label: 'Deposit Contribution',
  min: 0,
  max: propertyPrice,
  sliderMin: 0,
  sliderMax: propertyPrice,
  step: 10000,
  impact: 'positive',
  prefix: '$',
  suffix: ' AUD',
  formatBound: formatCompactMoney,
});

export const loanAmountField = (propertyPrice) => ({
  label: 'Loan Amount',
  min: 0,
  max: propertyPrice,
  sliderMin: 0,
  sliderMax: propertyPrice,
  step: 10000,
  impact: 'negative',
  prefix: '$',
  suffix: ' AUD',
  formatBound: formatCompactMoney,
});

export const AVAILABLE_SAVINGS_FIELD = {
  label: 'Available Savings',
  min: 0,
  max: 10000000,
  sliderMin: 0,
  sliderMax: 3000000,
  step: 10000,
  impact: 'positive',
  prefix: '$',
  suffix: ' AUD',
  formatBound: formatCompactMoney,
};

// min must stay above 0: a 0% rate makes calculateMonthlyPayment divide 0 by 0,
// turning every figure on the page into NaN.
export const INTEREST_RATE_FIELD = {
  label: 'Interest Rate',
  min: 0.1,
  max: 20,
  sliderMin: 3,
  sliderMax: 10,
  step: 0.01,
  impact: 'negative',
  suffix: '% p.a.',
  formatValue: (v) => v.toFixed(2),
};

// TODO-139: neutral, not negative - verified numerically against the actual
// offset loop (not the textbook amortization formula) that a longer term does
// not monotonically raise total interest once there's monthly surplus: freeing
// up cash by extending the term just routes more of it into the offset instead,
// nearly interchangeable with a shorter term's faster paydown. Direction flips
// with the rest of the user's inputs.
export const LOAN_TERM_FIELD = {
  label: 'Loan Term',
  min: 1,
  max: 30,
  sliderMin: 5,
  sliderMax: 30,
  step: 1,
  impact: 'neutral',
  suffix: ' years',
};
