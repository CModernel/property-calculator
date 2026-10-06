// TODO-185: what an income `amount` means depends on its recurrence. Monthly
// income (a salary, a weekly rent) is entered per WEEK, as the form has always
// said. Quarterly, yearly and one-time income (a dividend, a bonus, a tax
// refund) is entered per PAYMENT - before this, it was read as per week too,
// so a quarterly $300 dividend paid $1,300 and a one-time $5,000 bonus $21,667.
//
// Every downstream formula is built on weekly units (calculateMonthlyFromWeekly's
// x52/12, the tax step's x52, Rental Yield's x52, the weekly/fortnightly cards),
// so rather than teach each of them about recurrence, each consumer converts its
// income list once on entry: a per-payment amount becomes the weekly figure that
// x52/12 maps back to exactly that payment. Apply it ONCE per consumer - a list
// converted twice is shrunk twice.
const WEEKS_PER_MONTH_INVERSE = 12 / 52;

export function isPerPaymentIncome(item) {
  return item.recurrence !== 'monthly';
}

// The unit an income amount is shown in, matching how it is read above.
const PER_PAYMENT_UNITS = { quarterly: ' per quarter', yearly: ' per year', none: ' one-time' };
export function incomeAmountUnit(item) {
  return isPerPaymentIncome(item) ? (PER_PAYMENT_UNITS[item.recurrence] ?? ' per payment') : '/week';
}

export function toWeeklyEquivalent(incomeSources) {
  return incomeSources.map((item) => {
    if (!isPerPaymentIncome(item)) return item;
    const converted = { ...item, amount: item.amount * WEEKS_PER_MONTH_INVERSE };
    if (item.amountPerPerson != null) converted.amountPerPerson = item.amountPerPerson * WEEKS_PER_MONTH_INVERSE;
    return converted;
  });
}
