import { getSteppedValue } from './steppedValue';
import { getActiveAmount, getActiveAmountWithGrowth } from './recurringAmount';
import { SALARY_INCOME_CATEGORY, RENTAL_INCOME_CATEGORIES } from './incomeCategories';
import {
  calculateMonthlyFromWeekly,
  calculateMonthlyRate,
  calculateMonthlyPayment,
  calculateMonthlyStrata,
  calculateMonthlyCouncil,
  calculateMonthlyWaterRates,
  calculateMonthlyLandTax,
  calculateMonthlyPropertyExpenses,
} from './loan';
import { calculateCompoundedValue } from './growthRate';
import { calculateVacancyFactor } from './vacancyFactor';

export function calculateLoanWithOffset({
  contributions,
  // Merged with what used to be Groceries/Transport/Phone-Internet
  // (SteppedExpenseField/expenseFields) - TODO-66 rebuilt those as regular
  // Schedule-shaped list entries here, same as any other personal expense.
  // TODO-85 folded the former separate "Other Expenses" list into this
  // same array - callers no longer pass a distinct otherExpenseItems param.
  personalExpenseItems,
  incomeSources = [],
  expenseFields = null,
  monthlyToOffset,
  loanAmount,
  monthlyRate,
  monthlyPayment,
  // TODO-57: optional {base, changes} - when given, the loop re-resolves the
  // annual rate every month and, on any month where it differs from the
  // previous one, re-amortizes the REMAINING balance over the REMAINING term
  // at the NEW rate (matching how a real variable-rate mortgage recalculates
  // its repayment) instead of just swapping the interest/principal split at a
  // stale fixed installment. Omitted entirely -> identical to the old fixed-
  // rate behavior (monthlyRate/monthlyPayment never change), so every caller
  // that doesn't pass this keeps working unchanged.
  interestRateField = null,
  // TODO-80/136: the user's pre-existing cash position at settlement - the
  // real caller seeds this with cashRemaining (the static "Remaining
  // Savings" figure, src/calculations/totalCashRequired.js), the actual
  // cash sitting in the bank right after settlement. Defaults to 0 so
  // existing tests that don't care about it are unaffected.
  // TODO-136 removed the ONGOING savings destination (the old
  // offsetAllocationPct split): monthly surplus now goes to the offset and
  // the ETF only, never to a third savings pool. This balance is a starting
  // position that compounds on its own, not somewhere new money lands.
  initialSavingsBalance = 0,
  // TODO-50: annual % interest on the savings balance, compounded monthly.
  // 0 (the default) means every existing caller/test that omits this keeps
  // the old "savings never earns anything" behavior byte-for-byte.
  savingsInterestRate = 0,
  // TODO-89: property value over time, for the Timeline Explorer's
  // "Projected Equity" figure - a pure function of elapsed months, not an
  // accumulator (see calculateCompoundedValue). 0/0 defaults mean every
  // existing caller/test that omits these keeps working unchanged (no
  // propertyValue field is read by anything that doesn't ask for it).
  propertyPrice = 0,
  propertyGrowthRate = 0,
  // TODO-90: annual % growth applied only to Salary/Wages income sources,
  // compounding from simulation month 1 (a deliberate simplification, same
  // convention as propertyGrowthRate above) - independent of every other
  // rate in this app, since real wage growth doesn't track inflation or
  // property/savings returns. 0 (default) means every existing caller/test
  // that omits this keeps working unchanged.
  salaryGrowthRate = 0,
  // TODO-91: annual % growth applied only to rental income sources
  // (House Rent/Room Rent, RENTAL_INCOME_CATEGORIES), same convention as
  // salaryGrowthRate above - independent of it, since rent and wages move
  // on their own schedules. 0 (default) means every existing caller/test
  // that omits this keeps working unchanged.
  rentGrowthRate = 0,
  // TODO-92: annual % growth applied to BOTH Personal Expenses and
  // Property Expenses together, compounding monthly from simulation
  // month 1 (same convention as propertyGrowthRate/salaryGrowthRate) - a
  // single shared rate, not two independent ones, to keep this an
  // easily-understood, single-concept feature. Deliberately distinct
  // from `inflationRate` (TODO-93, App.jsx) - that one is a pure
  // display-layer "today's dollars" conversion applied AFTER the
  // simulation runs and never changes its output; this one genuinely
  // changes payoff time and total interest, since it grows the
  // surplus-reducing expenses inside the loop itself.
  expenseGrowthRate = 0,
  // TODO-95: weeks/year a rental property sits vacant, modeled as a flat
  // deterministic average haircut on rental income every month (e.g.
  // 2/52 weeks -> ~3.8% reduction) - not a random/stochastic event, to
  // keep this app's fully-deterministic design intact. 0 (default) means
  // every existing caller/test that omits this keeps working unchanged.
  vacancyWeeksPerYear = 0,
  // TODO-94: flat % converting any income source marked "Gross" (isGross)
  // to net, applied inside getActiveAmount/getActiveAmountWithGrowth
  // before growth/vacancy. 0 (default) means every existing caller/test
  // that omits this keeps working unchanged - isGross items only exist if
  // a caller explicitly adds them.
  effectiveTaxRate = 0,
  // TODO-129: negative gearing - when this investment property's own cash
  // flow (rental income minus property expenses minus loan interest) is
  // negative some month, the loss reduces the investor's OTHER taxable
  // income at effectiveTaxRate, a real tax BENEFIT credited back into the
  // offset (see the loop below). Fully automatic once true - no separate
  // opt-in, matching how Land Tax/Property Management already auto-apply
  // on this same flag. false (default) means every existing caller/test
  // that omits this keeps working unchanged.
  isInvestmentProperty = false,
  // TODO-96/136: what share of the month's POSITIVE surplus goes to a
  // growing ETF balance instead of the offset - the offset takes the
  // remainder. TODO-136 made this a direct split of the whole surplus;
  // it used to carve a slice out of the offset's own share after an
  // offsetAllocationPct offset-vs-savings split ran first. At that
  // parameter's old 100 default the two are arithmetically identical
  // (100% of surplus reached the offset, so a % of it was a % of the
  // whole), so this is not a behavior change for anyone who left it
  // alone. 0 (default) sends the entire surplus to the offset.
  etfAllocationPct = 0,
  // TODO-96: annual % expected ETF return, taxed by effectiveTaxRate
  // before being applied (an untaxed ETF return compared against the
  // offset's tax-free return would be a dishonest comparison - see
  // TODO-94). 0 (default) means every existing caller/test that omits
  // this keeps working unchanged.
  expectedEtfReturn = 0,
  // TODO-98: gates when etfAllocationPct actually kicks in - it's a no-op
  // until offsetBalance reaches this % of the REMAINING loan balance.
  // TODO-145 correction: this used to claim it "switches on for good... the
  // ratio never decreases, so this can't un-trigger". That stopped being true
  // at TODO-136, when a deficit month began drawing the offset down. The check
  // below is re-evaluated every month, so it can un-trigger. 0 (default) means
  // active from month 1, exactly matching TODO-96's original behavior -
  // every existing caller/test that omits this keeps working unchanged.
  switchThresholdPct = 0,
  // TODO-144(a): don't invest anything before this month, whatever the offset
  // balance happens to be. switchThresholdPct provably cannot express this: it
  // gates on offsetBalance/balance, a ratio of two quantities that both move
  // every month as an emergent result of the whole simulation, so the month it
  // crosses a given value is an OUTPUT rather than something the user sets -
  // and it's loan-relative, so the same threshold means a different delay on a
  // different loan. 1-indexed to match the app's `startMonth` convention
  // (recurringAmount.js's isScheduleActive). 1 (default) means no delay, so
  // every existing caller/test that omits this keeps working unchanged.
  etfStartMonth = 1,
  // TODO-144(b): don't invest until the offset covers this many months of
  // total outgoings. Expenses-relative, unlike switchThresholdPct's
  // loan-relative ratio - "I want six months of runway banked before I take
  // market risk" is a different question from "I want 20% of the loan offset".
  // One month of outgoings is defined exactly as the Emergency Buffer
  // indicator defines it (loan installment + property expenses + personal
  // expenses, see purchaseHealthCheck.js's calculateEmergencyBufferMonths), so
  // the slider and that indicator speak the same language. 0 (default) means
  // no reserve required - every existing caller/test is unaffected.
  etfReserveMonths = 0,
  // TODO-145: a one-off market drop, for "how much does this bet actually put
  // at risk?". 0 (default) means no crash at all, so every existing
  // caller/test is unaffected; when set it's 1-indexed like etfStartMonth.
  //
  // Deliberately does NOT model selling ETF units to cover a shortfall. That
  // would make the model MORE optimistic than it is today (a deficit currently
  // reports a shortfall even when ETF assets exist), silently changing every
  // existing scenario. The consequence is worth stating plainly rather than
  // hiding: because etfBalance is never read by the loan side, a crash cannot
  // change payoff time, total interest, or the reported cash shortfall. That
  // isn't a gap in the stress test - it IS the finding, and the UI says so.
  etfCrashMonth = 0,
  etfCrashPct = 0,
  maxMonths = 30 * 12,
}) {
  // Nothing to offset: no surplus, no scheduled contributions, and no income
  // sources (including Tenants, which now live inside incomeSources) that
  // could kick in later either. The sentinel years/interest values mean
  // "does not pay off early". `months` must be present and match the full
  // term - callers read it for the timeline bounds, and omitting it used to
  // render "Middle (NaN)" / "End (undefined)".
  // TODO-50: this early-out is only valid when the savings balance ALSO has
  // nothing left to do - a nonzero initialSavingsBalance still compounds
  // every month under a nonzero savingsInterestRate even with zero ongoing
  // surplus/income/contributions, so that combination must fall through to
  // the real loop instead of being skipped.
  if (
    monthlyToOffset <= 0 &&
    incomeSources.length === 0 &&
    contributions.reduce((s, c) => s + c.amount, 0) === 0 &&
    !(initialSavingsBalance > 0 && savingsInterestRate > 0)
  ) {
    // TODO-167: hasUsableProjection is the ONLY sanctioned way to detect this
    // path. Consumers used to branch on the magic numbers themselves and get
    // it wrong - one guessed `months >= 999 * 12` when `months` is maxMonths
    // here, and three display sites never checked at all and rendered
    // "$999,999" / "1029" as if they were real. See hasUsableProjection in
    // usableProjection.js, which every consumer must go through.
    return { years: 999, months: maxMonths, totalInterest: 999999, totalSavingsInterest: 0, totalNegativeGearingBenefit: 0, totalCashShortfall: 0, monthsWithShortfall: 0, totalDrawnFromSavings: 0, monthlyData: [], hasUsableProjection: false };
  }

  // TODO-90/91: split once outside the loop (incomeSources itself never
  // changes during the simulation) rather than filtering on every
  // iteration. Three-way: Salary/Wages grows at salaryGrowthRate, rental
  // (House Rent/Room Rent) grows at rentGrowthRate independently, and
  // everything else (Dividends, Bonus, etc.) resolves plain as before.
  const salaryIncomeSources = incomeSources.filter(i => i.name === SALARY_INCOME_CATEGORY);
  const rentalIncomeSources = incomeSources.filter(i => RENTAL_INCOME_CATEGORIES.includes(i.name));
  // TODO-95: a flat multiplier for the whole simulation - not a per-month
  // accumulator, just applied to rental income below.
  const vacancyFactor = calculateVacancyFactor(vacancyWeeksPerYear);
  const otherIncomeSources = incomeSources.filter(
    i => i.name !== SALARY_INCOME_CATEGORY && !RENTAL_INCOME_CATEGORIES.includes(i.name)
  );

  let balance = loanAmount;
  let offsetBalance = 0;
  let savingsBalance = initialSavingsBalance;
  // TODO-96: no initialEtfBalance param - there's no "current ETF
  // holdings" input anywhere in the app, so 0 is the only sensible seed.
  let etfBalance = 0;
  let totalInterest = 0;
  let totalSavingsInterest = 0;
  let totalNegativeGearingBenefit = 0;
  // TODO-170: how much of the user's own bank savings the plan had to consume
  // to stay afloat. Reported so a deficit absorbed by savings cannot pass
  // silently as "no shortfall" - the money still got spent.
  let totalDrawnFromSavings = 0;
  // TODO-136: months where the deficit outlived the offset balance - real
  // money the plan doesn't cover, which the old Math.max(0, ...) floor used
  // to swallow silently.
  let totalCashShortfall = 0;
  let monthsWithShortfall = 0;
  let months = 0;
  const monthlyData = [];
  const savingsMonthlyRate = calculateMonthlyRate(savingsInterestRate);
  // TODO-96/131: taxed before being applied - see the param comment above
  // for why this isn't just expectedEtfReturn as-is. Uses HALF of
  // effectiveTaxRate, not the full rate: AU capital gains held >12 months
  // get the 50% CGT discount before the marginal rate applies, unlike
  // ordinary (PAYG) income. ETF investing is already framed everywhere in
  // this app as a long-term, hard-to-reverse commitment, so a >12-month
  // holding is assumed throughout.
  const etfMonthlyRate = calculateMonthlyRate(expectedEtfReturn * (1 - (effectiveTaxRate * 0.5) / 100));

  // The caller's monthlyToOffset already has the ORIGINAL (month-1)
  // monthlyPayment baked in (see App.jsx's baseMonthlySurplus) - a rate
  // change discovered mid-loop can only be corrected here, by adding back the
  // difference between that original payment and whatever's active this
  // month (see netMonthlyDeposit below).
  const initialMonthlyPayment = monthlyPayment;
  let currentAnnualRate = interestRateField
    ? getSteppedValue(interestRateField.base, interestRateField.changes, 1)
    : null;
  let currentMonthlyRate = monthlyRate;
  let currentMonthlyPayment = monthlyPayment;

  while (balance > 0.01 && months < maxMonths) {
    months++;

    if (interestRateField) {
      const annualRateThisMonth = getSteppedValue(interestRateField.base, interestRateField.changes, months);
      if (annualRateThisMonth !== currentAnnualRate) {
        currentAnnualRate = annualRateThisMonth;
        currentMonthlyRate = calculateMonthlyRate(currentAnnualRate);
        // +1: `months` is this (about-to-be-paid) installment's own 1-indexed
        // number, so the remaining term INCLUDES it - e.g. at months=6 of a
        // 12-month loan, 7 payments (6 through 12) are left, not 6.
        currentMonthlyPayment = calculateMonthlyPayment(balance, currentMonthlyRate, maxMonths - months + 1);
      }
    }

    // Apply any offset contributions active this month - a one-time
    // contribution (recurrence: 'none') only fires on its exact startMonth,
    // same as before; a recurring one now fires every month/quarter/year
    // within its range, same resolution as Income Sources/Exceptional Expenses.
    offsetBalance += getActiveAmount(contributions, months);

    // TODO-92: a single growth multiplier applied to both expense
    // categories below - a no-op (1) at the 0% default.
    const expenseGrowthMultiplier = calculateCompoundedValue(1, expenseGrowthRate, months);

    // Personal expenses for this month - Groceries/Transport/Phone-Internet,
    // any exceptional/recurring cost, and (TODO-85) the former "Other
    // Expenses" categories (Health/Subscriptions/Entertainment/Debt
    // Repayment/Custom) - all resolved the same way as a direct
    // per-occurrence dollar amount, not a $/week rate.
    const monthlyPersonalExpensesCost = getActiveAmount(personalExpenseItems, months) * expenseGrowthMultiplier;

    // Income sources active this month (salary, other income, one-time
    // payments, and Tenants) - a value that can change mid-simulation (a
    // date-ranged or one-time source) can't be pre-collapsed into a single
    // constant outside the loop, unlike the old single fortnightlyIncome
    // scalar this replaced.
    // TODO-90/91/95: Salary/Wages sources grow at salaryGrowthRate, rental
    // sources grow at rentGrowthRate independently and are haircut by
    // vacancyFactor; everything else resolves the same way as before (a
    // no-op split at 0%/0%/no-vacancy, since getActiveAmountWithGrowth
    // matches getActiveAmount exactly and vacancyFactor is 1 then).
    const monthlyIncomeThisMonth = calculateMonthlyFromWeekly(
      getActiveAmountWithGrowth(salaryIncomeSources, months, salaryGrowthRate, effectiveTaxRate)
        + getActiveAmountWithGrowth(rentalIncomeSources, months, rentGrowthRate, effectiveTaxRate) * vacancyFactor
        + getActiveAmount(otherIncomeSources, months, effectiveTaxRate)
    );

    // Property expenses for this month, each resolved to whichever scheduled
    // change (if any) is in effect - same reasoning as tenant rent above: a
    // value that can change mid-simulation can't be pre-collapsed into a
    // single constant outside the loop.
    let monthlyExpensesForMonth = 0;
    if (expenseFields) {
      const strata = getSteppedValue(expenseFields.strataFees.base, expenseFields.strataFees.changes, months);
      const utilities = getSteppedValue(expenseFields.utilities.base, expenseFields.utilities.changes, months);
      const council = getSteppedValue(expenseFields.councilRates.base, expenseFields.councilRates.changes, months);
      const insurance = getSteppedValue(expenseFields.insurance.base, expenseFields.insurance.changes, months);
      const maintenance = getSteppedValue(expenseFields.maintenance.base, expenseFields.maintenance.changes, months);
      const waterRates = getSteppedValue(expenseFields.waterRates.base, expenseFields.waterRates.changes, months);
      const landTax = getSteppedValue(expenseFields.landTax.base, expenseFields.landTax.changes, months);
      const propertyManagement = getSteppedValue(
        expenseFields.propertyManagement.base,
        expenseFields.propertyManagement.changes,
        months
      );
      // TODO-82: optional - older calls/tests that build expenseFields by
      // hand without this key keep working, resolving to 0.
      const miscPropertyExpense = expenseFields.miscPropertyExpense
        ? getSteppedValue(expenseFields.miscPropertyExpense.base, expenseFields.miscPropertyExpense.changes, months)
        : 0;
      monthlyExpensesForMonth = calculateMonthlyPropertyExpenses({
        monthlyStrata: calculateMonthlyStrata(strata),
        utilities,
        monthlyCouncil: calculateMonthlyCouncil(council),
        insurance,
        maintenance,
        monthlyWaterRates: calculateMonthlyWaterRates(waterRates),
        monthlyLandTax: calculateMonthlyLandTax(landTax),
        propertyManagement,
        miscPropertyExpense,
      });
      // TODO-92: grows the WHOLE resolved property-expenses figure, on top
      // of whatever SteppedExpenseField value (possibly itself scheduled
      // to change) is active this month - doesn't touch each field's own
      // resolution, just overlays a multiplier on the final sum.
      monthlyExpensesForMonth *= expenseGrowthMultiplier;
    }

    // This month's net cash flow (income, minus property/personal expenses
    // and exceptional expenses). We assume exceptional expenses come out of
    // the surplus first.
    // `monthlyToOffset` here excludes income and expenseFields - both are
    // added/subtracted per month above instead, since neither can be
    // pre-collapsed into a single constant once either can change
    // mid-simulation. The `(initialMonthlyPayment - currentMonthlyPayment)`
    // term corrects for a rate change (TODO-57): it's 0 whenever the payment
    // hasn't changed, and otherwise reconciles monthlyToOffset's stale baked-
    // in original payment with whatever installment is actually active now.
    // TODO-136: SIGNED - this used to be wrapped in Math.max(0, ...), which
    // silently pretended a deficit month cost nothing. A shortfall is real
    // money the plan doesn't cover, so it's now drawn from the offset and,
    // once that's empty, reported (see the branch below).
    const netMonthlyCashFlow = monthlyToOffset + (initialMonthlyPayment - currentMonthlyPayment)
      + monthlyIncomeThisMonth - monthlyExpensesForMonth - monthlyPersonalExpensesCost;
    // TODO-50: interest accrues on last month's ending balance BEFORE this
    // month's deposit is added - matches how a real bank statement works
    // (existing balance earns interest, new deposits start earning next
    // month). Runs even when savingsInterestRate is 0 (a no-op multiply).
    // TODO-170: the account receives no deposits (TODO-136 removed the ongoing
    // savings destination) but it now has WITHDRAWALS, drawn further down to
    // cover a deficit month. This line runs first, so money spent later in the
    // month still earns that month's interest - the mirror of the deposit rule
    // above, and what a real account paying on the daily balance would do.
    // Deliberately left where it is: moving it after the draw would silently
    // change totalSavingsInterest for every existing scenario (see TODO-173,
    // which owns the pre/post-deposit convention question).
    const savingsInterestThisMonth = savingsBalance * savingsMonthlyRate;
    savingsBalance += savingsInterestThisMonth;
    totalSavingsInterest += savingsInterestThisMonth;
    // TODO-96: same "grows on last month's balance before this month's
    // deposit" convention as savings above - a no-op at the 0% default.
    etfBalance += etfBalance * etfMonthlyRate;

    // TODO-145: the crash lands here on purpose - after this month's growth,
    // BEFORE this month's contribution (below). Same "before the deposit"
    // convention as the growth line above, so a drop hits standing holdings
    // and leaves the crash month's own contribution intact. Applying it after
    // the contribution would also wipe money deposited that same month, which
    // models something different.
    if (etfCrashMonth > 0 && months === etfCrashMonth) {
      etfBalance *= (1 - etfCrashPct / 100);
    }

    // TODO-98/144: three independent "not yet" gates gating when
    // etfAllocationPct actually kicks in. Each defaults to a no-op, and the UI
    // only ever moves one away from its default at a time (a single "start
    // investing when..." selector), so ANDing them here keeps this function
    // dumb about which criterion the user picked.
    //
    // TODO-145 corrected a stale claim that used to live here: this was
    // justified as safe because "the ratio only ever grows", which stopped
    // being true at TODO-136 - a deficit month draws the offset down, so
    // offsetBalance/balance CAN fall and these checks CAN un-trigger. The
    // stateless re-evaluation is deliberate rather than merely tolerated:
    // if your offset drops back below the reserve you wanted banked, pausing
    // new ETF contributions until it recovers is the behaviour you'd want, not
    // a bug. Existing behaviour is unchanged - only the reasoning was wrong.
    const etfRatioReached = (offsetBalance / balance) * 100 >= switchThresholdPct;
    const etfStartMonthReached = months >= etfStartMonth;
    // Same composition as the Emergency Buffer indicator's denominator, and
    // built from the loop's own per-month figures rather than from
    // monthlyToOffset - that already has the month-1 installment baked in, so
    // reusing it here would double-count the repayment.
    const monthlyOutgoingsThisMonth = currentMonthlyPayment + monthlyExpensesForMonth + monthlyPersonalExpensesCost;
    const etfReserveReached = offsetBalance >= etfReserveMonths * monthlyOutgoingsThisMonth;
    const etfSwitchActive = etfRatioReached && etfStartMonthReached && etfReserveReached;
    const effectiveEtfAllocationPct = etfSwitchActive ? etfAllocationPct : 0;
    // TODO-136: the direct Offset-vs-ETF split. A surplus month divides
    // between the two; there is no third savings destination any more (the
    // offset already gives you everything a savings account does - fully
    // liquid - PLUS it reduces guaranteed, effectively tax-free interest).
    let cashShortfallThisMonth = 0;
    if (netMonthlyCashFlow >= 0) {
      const etfShare = netMonthlyCashFlow * (effectiveEtfAllocationPct / 100);
      offsetBalance += netMonthlyCashFlow - etfShare;
      etfBalance += etfShare;
    } else {
      // A deficit draws down the offset first, and NEVER below zero. That
      // floor is load-bearing, not defensive: a negative offsetBalance would
      // make effectiveBalance exceed balance below, inflating interest and
      // breaking the re-amortization guarantee that a loan still pays off
      // exactly at term end. Deliberately no ETF contribution in a deficit
      // month - you cannot invest money you don't have.
      const deficit = -netMonthlyCashFlow;
      const drawnFromOffset = Math.min(deficit, offsetBalance);
      offsetBalance -= drawnFromOffset;
      // TODO-170: then the bank savings, before anything is called a shortfall.
      // Without this the engine reported money as "unfunded" while the cash it
      // was seeded with sat untouched - on the shipped default plus a $60,000
      // one-off, a $45,616 shortfall against a $28,453 savings balance still
      // showing on the same screen.
      //
      // The Math.min floor is required, not defensive: a negative
      // savingsBalance would flow into monthlyData's `savings`, into
      // accessibleCash/netWorth in strategyScenarios.js, and into next month's
      // savingsBalance * savingsMonthlyRate as NEGATIVE interest, compounding a
      // debt this model has no way to represent. Unlike the offset's own zero
      // floor this one is not load-bearing for interest, since savingsBalance
      // never feeds effectiveBalance.
      const stillShort = deficit - drawnFromOffset;
      const drawnFromSavings = Math.min(stillShort, savingsBalance);
      savingsBalance -= drawnFromSavings;
      totalDrawnFromSavings += drawnFromSavings;
      cashShortfallThisMonth = stillShort - drawnFromSavings;
      if (cashShortfallThisMonth > 0) {
        totalCashShortfall += cashShortfallThisMonth;
        monthsWithShortfall++;
      }
    }

    // Offset cannot exceed loan balance
    const effectiveOffset = Math.min(offsetBalance, balance);

    // Balance on which interest is calculated
    const effectiveBalance = balance - effectiveOffset;

    // Monthly interest on effective balance
    const monthlyInterest = effectiveBalance * currentMonthlyRate;
    totalInterest += monthlyInterest;

    // TODO-129: negative gearing - a SECOND, independent computation of the
    // same rental-income sub-expression already inlined into
    // monthlyIncomeThisMonth above (not extracted from it) - refactoring
    // that combined calculateMonthlyFromWeekly(a+b+c) call into three
    // separate calls would risk sub-cent floating-point drift across every
    // other describe block in this file, for no benefit.
    if (isInvestmentProperty) {
      const rentalIncomeThisMonth = calculateMonthlyFromWeekly(
        getActiveAmountWithGrowth(rentalIncomeSources, months, rentGrowthRate, effectiveTaxRate) * vacancyFactor
      );
      // Compares the PROPERTY's own income against its own deductible costs
      // (property expenses + loan interest) - personal expenses deliberately
      // play no part, same as real negative gearing.
      const propertyCashFlow = rentalIncomeThisMonth - monthlyExpensesForMonth - monthlyInterest;
      if (propertyCashFlow < 0) {
        // Full effectiveTaxRate, NOT TODO-131's 50%-CGT-discounted rate -
        // that discount is specific to capital gains; this is ordinary-
        // income relief. Added directly to offsetBalance, bypassing the
        // etfAllocationPct split entirely, same as one-time
        // Offset Contributions above - and only AFTER this month's own
        // monthlyInterest/effectiveOffset are already fixed, so the benefit
        // affects next month's offset onward, never this month's (avoids a
        // circular dependency on the interest figure it's derived from).
        const negativeGearingBenefit = -propertyCashFlow * (effectiveTaxRate / 100);
        offsetBalance += negativeGearingBenefit;
        totalNegativeGearingBenefit += negativeGearingBenefit;
      }
    }

    // Pay the installment (interest + principal)
    const principalPayment = currentMonthlyPayment - monthlyInterest;
    balance = Math.max(0, balance - principalPayment);

    // TODO-168: retire the loan BEFORE the month is photographed. There used to
    // be a `balance = 0` after the break below, which is what this always meant
    // to do - but it ran after monthlyData.push, so nothing could ever observe
    // it, and the final row kept the balance the offset had just extinguished.
    // The shipped default reported months: 108 next to a final row reading
    // balance: 357095, and the Strategy Comparison table then told the user the
    // FASTEST-paying strategy still owed that at year 30.
    //
    // Discharging costs the offset the money it discharged with: leaving
    // offsetBalance untouched while zeroing the balance would overstate net
    // worth by the whole balance (you'd own the house outright AND still hold
    // the cash). Reducing it keeps `-balance + offset` summing to what it
    // always did, so net worth is unchanged on an organic payoff and CORRECTED
    // where a large contribution overshot the balance (there the old reading
    // understated it by the excess).
    const offsetRetiresLoan = balance > 0 && effectiveOffset >= balance;
    if (offsetRetiresLoan) {
      offsetBalance -= balance;
      balance = 0;
    }
    // Also true on an ordinary fully-amortized payoff, where the installment
    // itself took the balance to 0 and no offset was involved.
    const loanIsRetired = balance <= 0;

    // Save data for Timeline Explorer (Every Month)
    monthlyData.push({
      month: months,
      balance: Math.round(balance),
      offset: Math.round(offsetRetiresLoan ? offsetBalance : effectiveOffset),
      savings: Math.round(savingsBalance),
      etf: Math.round(etfBalance),
      effectiveBalance: Math.round(loanIsRetired ? 0 : effectiveBalance),
      monthlyInterestPaid: Math.round(monthlyInterest),
      totalInterestPaid: Math.round(totalInterest),
      totalPrincipalPaid: Math.round(loanAmount - balance),
      propertyValue: Math.round(calculateCompoundedValue(propertyPrice, propertyGrowthRate, months)),
      // TODO-136: 0 in any month the cash flow covered itself (or the offset
      // absorbed the deficit) - only positive once the offset ran dry.
      cashShortfall: Math.round(cashShortfallThisMonth)
    });

    // Equivalent to the old `effectiveOffset >= balance` case by case: an
    // already-zero balance (normal payoff) satisfied both; a positive balance
    // the offset covers is now zeroed above; a balance it cannot cover breaks
    // out of neither.
    if (loanIsRetired) break;
  }

  return {
    years: months / 12,
    months: months,
    totalInterest: totalInterest,
    totalSavingsInterest: totalSavingsInterest,
    totalNegativeGearingBenefit: totalNegativeGearingBenefit,
    totalCashShortfall: totalCashShortfall,
    monthsWithShortfall: monthsWithShortfall,
    totalDrawnFromSavings: totalDrawnFromSavings,
    monthlyData: monthlyData,
    // TODO-167: these figures came out of the real loop, so they are real
    // money. Note this says nothing about monthlyData being non-empty -
    // maxMonths: 0 is a genuine projection with no months in it.
    hasUsableProjection: true
  };
}
