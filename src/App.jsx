import { useState, lazy, Suspense } from 'react';
import { DollarSign, Home, Calendar, ShoppingCart, Car, RotateCcw, Wallet, Sun, Moon, Sprout, PiggyBank, TrendingUp } from 'lucide-react';
import { formatMonthsDetailed } from './calculations/formatting';
import NumberSliderField from './components/NumberSliderField';
import LvrBadge from './components/LvrBadge';
import InfoTooltip from './components/InfoTooltip';
// TODO-112: lazy - recharts (and the redux-toolkit/immer/d3 stack it
// vendors) is a large chunk of the production bundle, but these two charts
// only ever mount once showProgressCharts is toggled on below. Deferring
// the import keeps that whole module graph out of the initial bundle for
// anyone who never opens this card.
const LoanBalanceChart = lazy(() => import('./components/LoanBalanceChart'));
const PrincipalInterestChart = lazy(() => import('./components/PrincipalInterestChart'));
import { getNextSuggestion } from './calculations/suggestions';
import { getBalanceColor, getBalanceBgColor } from './calculations/ui';
import {
  calculateLoanAmount,
  calculateMonthlyRate,
  calculateMonthlyPayment,
  calculateMonthlyStrata,
  calculateMonthlyCouncil,
  calculateMonthlyWaterRates,
  calculateMonthlyLandTax,
  calculateMonthlyPropertyExpenses,
  calculateTotalPropertyCost,
  calculateInitialMonthlyInterest,
  calculateNoOffsetTotalInterest,
  calculateMonthlyFromWeekly,
  calculateMonthlyNetBalance,
  calculateWeeklyNetBalance,
  calculateFortnightlyNetBalance,
  calculateMonthlyToOffset,
  calculateWeeklyToOffset,
  calculateFortnightlyToOffset,
  calculateTotalScheduledOffset,
} from './calculations/loan';
import { calculateLoanWithOffset } from './calculations/offsetSimulation';
import { runStrategyGrid, selectParetoFront, calculateEtfCrashSurvivedPct, classifyEtfCrash } from './calculations/strategyComparison';
import { runStrategyScenarios, runReturnScenarios, runCrashScenarios, summariseStrategy, buildComparisonRows, getComparisonMonths, hasUsableData, YEARLY_STEP_MIN_MONTHS } from './calculations/strategyScenarios';
import { findBreakEvenEtfReturn } from './calculations/etfBreakEven';
import StrategyScenarioComparison from './components/StrategyScenarioComparison';
import EtfReturnSensitivity from './components/EtfReturnSensitivity';
import EtfCrashStressTest from './components/EtfCrashStressTest';
import RiskToleranceProfiles from './components/RiskToleranceProfiles';
import { calculateOffsetTimingBenefit, calculateCardCashback } from './calculations/creditCardBenefit';
import { calculatePresentValueOfInterest } from './calculations/inflation';
import { clampToRange } from './calculations/clampToRange';
import { safePercentage } from './calculations/safePercentage';
import { estimateLmi } from './calculations/lmi';
import { sumClosingCosts } from './calculations/closingCosts';
import { getStateModule } from './calculations/states';
import {
  calculateEmergencyBufferMonths, classifyEmergencyBuffer,
  calculateHousingCostRatio, classifyHousingCostRatio,
  calculateStressTestSurvivedDelta, classifyStressTest,
  calculateUpfrontCostRatio, classifyUpfrontCostRatio,
  classifyGearing,
  calculateVacancyBufferMonths, classifyVacancyBuffer,
  calculateRentalYield, hasEnoughDataForRentalYield, classifyRentalYield,
  calculateMortgageFreeAge, classifyMortgageFreeAge,
  calculateOffsetUtilisation, classifyOffsetUtilisation,
} from './calculations/purchaseHealthCheck';
import { findStabilizationMonth, resolveProjectedFinancials, worseOf } from './calculations/projectedHealthCheck';
import HealthCheckIndicator from './components/HealthCheckIndicator';
import { calculateTotalCashRequired, calculateCashRemaining, calculateLiquidSavings } from './calculations/totalCashRequired';
import { getSteppedValue } from './calculations/steppedValue';
import { getActiveAmount, isScheduleActive, countOccurrencesUpTo, classifyScheduleStatus, formatScheduleLabel } from './calculations/recurringAmount';
import { getTimelineSnapshot, calculateEffectiveProgress, calculateTimeRemaining } from './calculations/timelineSnapshot';
import { INCOME_CATEGORIES, INCOME_CATEGORY_DEFAULTS, RENTAL_INCOME_CATEGORIES } from './calculations/incomeCategories';
import { getSuggestedTaxRate, getMarginalRentalTaxRate } from './calculations/taxRateSuggestion';
import { useSteppedValue } from './hooks/useSteppedValue';
import { useDarkMode } from './hooks/useDarkMode';
import { useUiMode, UI_MODES } from './hooks/useUiMode';
import SimpleModeView from './components/SimpleModeView';
import { summariseAffordability } from './calculations/affordabilitySummary';
import { useScheduleForm } from './hooks/useScheduleForm';
import SteppedExpenseField from './components/SteppedExpenseField';
import ScheduleFields from './components/ScheduleFields';
import ImpactColorLegend from './components/ImpactColorLegend';
import {
  PROPERTY_PRICE_FIELD, depositContributionField, loanAmountField,
  AVAILABLE_SAVINGS_FIELD, INTEREST_RATE_FIELD, LOAN_TERM_FIELD,
} from './components/coreFieldConfigs';
import { loadScenario, saveScenario, clearScenario } from './persistence/scenarioStorage';
import { validateAmount, hasDuplicateOneTimeMonth } from './calculations/scheduleFormValidation';
import defaultConfig from '../config.default.json';

// config.local.json is git-ignored and optional - import.meta.glob resolves to
// an empty object (not a build error) when the file doesn't exist, so no
// runtime fetch or fallback branching is needed for the common case.
const localConfigModules = import.meta.glob('../config.local.json', { eager: true });
const localConfig = Object.values(localConfigModules)[0]?.default ?? {};
// A saved-in-browser scenario wins over both config files - it must replace
// the defaults outright, not patch over them after the fact, or the page
// would flash default values before the saved ones apply.
const savedScenario = loadScenario();
const config = { ...defaultConfig, ...localConfig, ...savedScenario };

// TODO-141: a scenario saved before the "Realistic Mode" gate was removed
// stored an explicit realisticModeEnabled flag, and when it was false the
// growth/vacancy/tax rates saved ALONGSIDE it were inert - the user was
// really looking at a flat 0% baseline. Load those scenarios as exactly
// that, so removing the gate never silently activates dormant values and
// changes someone's saved projection. Strict === false, so a fresh session
// (config.default.json has no such key -> undefined) is unaffected and gets
// the normal non-zero defaults, as does any scenario saved with it on.
// Once a scenario is re-saved it no longer carries the flag (see
// handleSaveScenario), so this decays on its own.
const legacyFlatBaseline = config.realisticModeEnabled === false;

// Personal Expenses picklist (TODO-85: merged in what used to be the
// separate "Other Expenses" section) - 'Custom' reveals a free-text name
// field (same pattern as Income Sources' 'Other'). No per-category
// Schedule defaults (unlike Income Sources) - the form's own baseline
// (recurring monthly) applies uniformly.
const PERSONAL_EXPENSE_CATEGORIES = ['Groceries', 'Transport', 'Bills', 'Health', 'Subscriptions', 'Entertainment', 'Debt Repayment', 'Custom'];

// Shared explanation for every monthly figure derived from a weekly amount
// (calculateMonthlyFromWeekly, src/calculations/loan.js) - answers "why
// doesn't this match my ×4 mental math?" (TODO-60).
const WEEKLY_TO_MONTHLY_TOOLTIP = (
  <p>Monthly figures convert weekly amounts using the actual number of weeks per year: <strong>52 ÷ 12 ≈ 4.33</strong>, not a flat ×4.</p>
);

// TODO-134: arrow prefix for a Health Check indicator's "stabilizes to..."
// annotation - whether the Stabilized reading is better, worse, or the same
// as Day 1, in that indicator's own direction (higherIsBetter/higherIsWorse).
function stabilizedArrow(day1Value, stabilizedValue, direction) {
  if (stabilizedValue === day1Value) return '→';
  const improved = direction === 'higherIsBetter' ? stabilizedValue > day1Value : stabilizedValue < day1Value;
  return improved ? '↗' : '↘';
}

// TODO-148: calculateStressTestSurvivedDelta returns 0 both when a scenario is
// already in deficit at today's rate and when it only fails once rates rise a
// point - it never separately probes +0. Distinguishing the two is presentation
// only (the function's own signature/return value is untouched); `alreadyInDeficit`
// is the caller's own already-computed net balance at the rate actually being
// tested (today's for Day-1, the Stabilized month's projected rate for that
// reading), not a new calculation.
function stressTestDisplay(survivedDelta, alreadyInDeficit) {
  if (survivedDelta > 0) return `Survives +${survivedDelta}%`;
  return alreadyInDeficit ? 'Already in deficit' : 'Fails at +1%';
}

// TODO-149: calculateEmergencyBufferMonths/calculateVacancyBufferMonths keep
// dividing liquidSavings by monthly outgoings unclamped, so a settlement that
// can't be funded at all produces a negative "months" figure - not a
// meaningful buffer size, and easy to misread as merely thin rather than
// "you can't fund this at all". Presentation only: the calculation and
// classification (still 🔴 High risk regardless) are untouched.
function bufferDisplay(months, liquidSavings) {
  if (liquidSavings < 0) return "Can't cover settlement";
  return Number.isFinite(months) ? `${months.toFixed(1)} months` : '∞';
}

// Same shortfall liquidSavings already represents in the "You've committed
// $X more than your savings cover" warning above (Available Savings summary)
// - restated here rather than invented afresh, so the two agree.
function bufferShortfallAction(liquidSavings) {
  return `Short by $${Math.abs(Math.round(liquidSavings)).toLocaleString()} at settlement - reduce the price, add to savings, or scale back scheduled contributions.`;
}

const PropertyInvestmentCalculator = () => {
  // Not stateful (no useState) - there's no UI to switch states yet, so this
  // is effectively a fixed config-level setting (TODO-58). Adding a state
  // selector later would just mean making this a useState like everything
  // else here.
  const stateModule = getStateModule(config.state ?? 'NSW');

  // A device/browser preference, not scenario data - deliberately its own
  // hook/localStorage key (TODO-47) so it survives "Reset to defaults".
  const [isDarkMode, toggleDarkMode] = useDarkMode();
  // TODO-135: which interface complexity to render. Own localStorage key, NOT
  // part of the saved scenario - loading a scenario must never change how
  // complex the interface is. See useUiMode.js for why that diverges from the
  // `show*` flags, which ARE saved.
  const [uiMode, toggleUiMode] = useUiMode();
  const isSimpleMode = uiMode === UI_MODES.simple;

  const [propertyPrice, setPropertyPrice] = useState(config.propertyPrice);
  // TODO-141: the growth/vacancy/tax assumptions below are ALWAYS active -
  // there is no longer a master on/off switch (the former "Realistic Mode",
  // TODO-100/103). A UI control must never silently select a different
  // financial model; setting a slider to 0 is how you ask for a flat
  // baseline, and that state describes itself (see the Loan Simulation
  // banner). This card's own collapse toggle is presentation only.
  const [showProjectionAssumptions, setShowProjectionAssumptions] = useState(config.showProjectionAssumptions ?? false);
  // TODO-102: collapses Financial Position's growth/inflation/opt-in
  // sliders behind an "⚙️ Advanced Assumptions" toggle - purely
  // presentational. See financialPositionAdvancedExpanded below, which
  // OR's this raw toggle with a "something inside is already customized"
  // check, so a returning user never loses visibility into settings
  // they've actually set.
  const [showFinancialPositionAdvanced, setShowFinancialPositionAdvanced] = useState(config.showFinancialPositionAdvanced ?? false);
  // TODO-89: annual % change in property value, compounding monthly - 0
  // (default) keeps propertyValue pinned at propertyPrice forever, same
  // as every other purely-additive rate input this session.
  // TODO-106: 5% p.a. - conservative end of commonly-cited long-run AU
  // housing growth (~5-7%), a sensible active starting point rather than a
  // no-op 0%. TODO-141: this now applies from the first render.
  const [propertyGrowthRate, setPropertyGrowthRate] = useState(legacyFlatBaseline ? 0 : (config.propertyGrowthRate ?? 5));
  const [propertyType, setPropertyType] = useState(config.propertyType); // 'house' | 'unit'
  const [downPayment, setDownPayment] = useState(config.downPayment);
  // TODO-57: a stepped/scheduled rate, same "Schedule a rate change" pattern
  // as Strata/Utilities/etc below - `interestRate` (the resolved "month 1"
  // value) is derived further down, right next to where it's used.
  const interestRateField = useSteppedValue(config.interestRate, config.interestRateChanges);
  const [loanTermYears, setLoanTermYears] = useState(config.loanTermYears);
  const strataFeesField = useSteppedValue(config.strataFees, config.strataFeesChanges);
  const utilitiesField = useSteppedValue(config.utilities, config.utilitiesChanges);
  const councilRatesField = useSteppedValue(config.councilRates, config.councilRatesChanges);
  const insuranceField = useSteppedValue(config.insurance, config.insuranceChanges);
  const maintenanceField = useSteppedValue(config.maintenance, config.maintenanceChanges);
  const waterRatesField = useSteppedValue(config.waterRates, config.waterRatesChanges);
  // TODO-82: a free-text "Misc" line item for any property expense not
  // covered by the 8 fields above - applies to every property type, not
  // gated by isInvestmentProperty like Land Tax/Property Management below.
  const miscPropertyExpenseField = useSteppedValue(config.miscPropertyExpense ?? 0, config.miscPropertyExpenseChanges);
  const [showPropertyExpenses, setShowPropertyExpenses] = useState(config.showPropertyExpenses ?? false);
  // Results panel: collapses the Property Balance card's "Monthly Expenses"
  // property-expense line items (Strata/Council/Utilities/Insurance/
  // Maintenance/Water/Land Tax/Property Management) behind their own
  // subtotal, same "breakdown" pattern as the input side - keeps the card
  // to 4 rows by default instead of 9+.
  const [showMonthlyExpensesBreakdown, setShowMonthlyExpensesBreakdown] = useState(config.showMonthlyExpensesBreakdown ?? false);

  // Investment-property-only expenses. Deliberately NOT wired to
  // isFirstHomeBuyer/calculateStampDuty (NSW's FHB concession really
  // requires occupying the property) - that interaction is a known,
  // documented gap (see TODO-38), not solved here.
  const [isInvestmentProperty, setIsInvestmentProperty] = useState(config.isInvestmentProperty ?? false);
  const landTaxField = useSteppedValue(config.landTax, config.landTaxChanges);
  const propertyManagementField = useSteppedValue(config.propertyManagement, config.propertyManagementChanges);

  // Upfront purchase costs (NSW)
  const [isFirstHomeBuyer, setIsFirstHomeBuyer] = useState(config.isFirstHomeBuyer);
  // Independent of isFirstHomeBuyer/isInvestmentProperty - foreign-purchaser
  // status depends on residency/citizenship, not occupancy intent or
  // investment status, so no mutual-exclusion logic applies here.
  const [isForeignPurchaser, setIsForeignPurchaser] = useState(config.isForeignPurchaser ?? false);
  const [totalSavings, setTotalSavings] = useState(config.totalSavings);
  // TODO-136 removed the old "Offset Allocation" slider (an offset-vs-savings
  // split of the monthly surplus). Surplus now goes to the offset, or to the
  // ETF via etfAllocationPct - there is no third savings destination, because
  // an offset already gives you everything a savings account does (fully
  // liquid) PLUS it reduces guaranteed, effectively tax-free loan interest.
  // TODO-50: annual % interest on the savings balance, compounded monthly -
  // 0 (the default) preserves the original "savings never earns anything"
  // behavior exactly.
  const [savingsInterestRate, setSavingsInterestRate] = useState(config.savingsInterestRate ?? 0);
  // TODO-92: annual % growth applied to BOTH Personal Expenses and Property
  // Expenses together, compounding monthly inside the simulation - 0
  // (default) keeps expenses flat. Deliberately distinct from
  // `inflationRate` (TODO-93) below, which only affects the "today's
  // dollars" display and never changes the simulation itself.
  // TODO-106: 2.5% p.a. - midpoint of the RBA's 2-3% inflation target band.
  const [expenseGrowthRate, setExpenseGrowthRate] = useState(legacyFlatBaseline ? 0 : (config.expenseGrowthRate ?? 2.5));
  // TODO-55: a static "right now" estimate (offset-timing benefit +
  // cashback), deliberately NOT wired into the simulation - see
  // src/calculations/creditCardBenefit.js. Off by default (useCreditCard),
  // so it costs nothing for anyone who doesn't opt in.
  const [useCreditCard, setUseCreditCard] = useState(config.useCreditCard ?? false);
  const [monthlyCardSpend, setMonthlyCardSpend] = useState(config.monthlyCardSpend ?? 1000);
  const [avgExtraDaysHeld, setAvgExtraDaysHeld] = useState(config.avgExtraDaysHeld ?? 27);
  const [cashbackPct, setCashbackPct] = useState(config.cashbackPct ?? 0);
  const [annualCardFee, setAnnualCardFee] = useState(config.annualCardFee ?? 0);
  // TODO-97: a static "right now" comparison (offset return vs. an ETF's
  // expected return), deliberately NOT wired into the simulation on its
  // own - just two rates shown side by side. Off by default, so it costs
  // nothing for anyone who doesn't opt in. TODO-96 below reuses
  // expectedEtfReturn as the actual simulation's growth rate too, so
  // there's a single source of truth for "what ETF return am I assuming."
  // Master visibility/enable switch for all ETF-specific controls and outputs.
  // New sessions default to hidden, while older saved scenarios that already
  // opted into either ETF feature remain visible after the TODO-126 rollout.
  const legacyEtfSettingsEnabled = config.useEtfInvesting === true || config.showOpportunityCost === true;
  const [showEtfInvestingOptions, setShowEtfInvestingOptions] = useState(
    config.showEtfInvestingOptions ?? legacyEtfSettingsEnabled
  );
  // TODO-137: collapse state for the "Extra Investments & Strategies" card.
  // Presentation only - it hides the ETF editors without changing what the
  // simulation does. showEtfInvestingOptions above is the control that
  // actually pauses the effect; keeping the two separate is TODO-141's rule.
  const [showExtraInvestments, setShowExtraInvestments] = useState(config.showExtraInvestments ?? false);
  // TODO-137: which figure the side-by-side comparison plots over time. Net
  // worth by default - it's the one where the offset-vs-ETF lines actually
  // cross, which is the whole question that panel exists to answer. Purely a
  // view preference, so it isn't part of the saved scenario.
  const [comparisonMetric, setComparisonMetric] = useState('netWorth');
  const [showOpportunityCost, setShowOpportunityCost] = useState(config.showOpportunityCost ?? false);
  // Defaults to a plausible long-term diversified-ETF figure (per this
  // session's own ETF analysis rounds) rather than 0, since this value is
  // only ever seen once the user has explicitly opted in above - a 0%
  // "expected return" would just look broken.
  const [expectedEtfReturn, setExpectedEtfReturn] = useState(config.expectedEtfReturn ?? 8);
  // TODO-96: diverts part of what would otherwise go to the offset into a
  // growing ETF balance instead - the actual offset-vs-ETF trade-off (slower
  // payoff, potentially higher return), not a further split of savings.
  // Gated on effectiveTaxRate being set (see the checkbox below) - an
  // untaxed ETF return compared against the offset's tax-free return would
  // be a dishonest comparison. Off by default, so it costs nothing for
  // anyone who doesn't opt in.
  const [useEtfInvesting, setUseEtfInvesting] = useState(config.useEtfInvesting ?? false);
  // 20% (not 0) so checking the box above has a visible effect immediately,
  // same reasoning as expectedEtfReturn's non-zero default.
  const [etfAllocationPct, setEtfAllocationPct] = useState(config.etfAllocationPct ?? 20);
  // TODO-98: 0 (default) means etfAllocationPct is active from month 1,
  // exactly matching TODO-96's original behavior - every existing
  // scenario behaves byte-for-byte identically until raised above 0.
  const [switchThresholdPct, setSwitchThresholdPct] = useState(config.switchThresholdPct ?? 0);
  // TODO-144: the three "start investing when..." criteria are mutually
  // exclusive in the UI (one selector), but the engine just ANDs all three with
  // no-op defaults - so exactly one is ever away from its default here.
  const [etfStartMonth, setEtfStartMonth] = useState(config.etfStartMonth ?? 1);
  const [etfReserveMonths, setEtfReserveMonths] = useState(config.etfReserveMonths ?? 0);
  // TODO-145: which month the stress test drops the ETF balance in. Defaults to
  // year 5 as a starting point for the panel - deliberately NOT the engine's own
  // `etfCrashMonth = 0` no-crash default, which stays 0 so omitting the param
  // anywhere else is inert.
  const [etfCrashMonth, setEtfCrashMonth] = useState(config.etfCrashMonth ?? 60);
  // Which criterion the selector shows. Derived from the saved params rather
  // than persisted separately, the same way legacyFlatBaseline reads intent out
  // of existing fields - so a scenario saved before this feature (which can
  // only carry a switchThresholdPct) lands on the right radio automatically,
  // with no SCHEMA_VERSION bump.
  const [etfStartTrigger, setEtfStartTrigger] = useState(() => {
    if ((config.etfStartMonth ?? 1) > 1) return 'month';
    if ((config.etfReserveMonths ?? 0) > 0) return 'reserve';
    if ((config.switchThresholdPct ?? 0) > 0) return 'loanRatio';
    return 'immediate';
  });

  // Only the selected criterion reaches the engine; the other two stay at their
  // no-op defaults, so switching criteria can never leave a stale gate applied.
  const effectiveEtfStartMonth = etfStartTrigger === 'month' ? etfStartMonth : 1;
  const effectiveEtfReserveMonths = etfStartTrigger === 'reserve' ? etfReserveMonths : 0;
  const effectiveSwitchThresholdPct = etfStartTrigger === 'loanRatio' ? switchThresholdPct : 0;
  // TODO-93: annual % - a pure display-layer conversion of "Total interest
  // paid" into today's dollars, no simulation changes. 0 (default) means
  // no inflation is modeled, matching every other purely-additive rate
  // input this session.
  // TODO-106: 2.5% p.a. - same RBA target-band midpoint as expenseGrowthRate.
  const [inflationRate, setInflationRate] = useState(legacyFlatBaseline ? 0 : (config.inflationRate ?? 2.5));
  // TODO-70: optional - 0 means "not provided", which hides the Mortgage-Free
  // Age indicator entirely rather than forcing anyone to disclose their age.
  const [currentAge, setCurrentAge] = useState(config.currentAge ?? 30);
  const [showMortgageFreeAge, setShowMortgageFreeAge] = useState(config.showMortgageFreeAge ?? false);
  const [payLmiUpfront, setPayLmiUpfront] = useState(false);
  // TODO-68/69/70: collapsed by default, like the other detail panels.
  const [showHealthCheck, setShowHealthCheck] = useState(config.showHealthCheck ?? false);
  const [showClosingCostsBreakdown, setShowClosingCostsBreakdown] = useState(config.showClosingCostsBreakdown ?? false);
  const [conveyancing, setConveyancing] = useState(config.conveyancing);
  const [buildingInspection, setBuildingInspection] = useState(config.buildingInspection);
  const [pestInspection, setPestInspection] = useState(config.pestInspection);
  const [registrationFees, setRegistrationFees] = useState(config.registrationFees);
  const [searches, setSearches] = useState(config.searches);
  const [loanEstablishmentFee, setLoanEstablishmentFee] = useState(config.loanEstablishmentFee);
  const [propertyValuation, setPropertyValuation] = useState(config.propertyValuation);
  const [homeInsurance, setHomeInsurance] = useState(config.homeInsurance);
  const [rateAdjustments, setRateAdjustments] = useState(config.rateAdjustments);
  // TODO-83: a free-text "Misc" one-time upfront cost, same idea as
  // miscPropertyExpenseField above but for Upfront Costs.
  const [miscUpfrontCost, setMiscUpfrontCost] = useState(config.miscUpfrontCost ?? 0);

  // Income sources (salary, other income, house rent, one-time payments) - a
  // single "Schedule" shape { startMonth, recurrence: 'none'|'monthly'|
  // 'quarterly'|'yearly', endMonth }, shared with Exceptional Expenses and
  // resolved per month via getActiveAmount (src/calculations/recurringAmount.js).
  // A 'Room Rent' entry additionally carries isShared/numPeople/amountPerPerson
  // (see addIncomeSource) - RENTAL_INCOME_CATEGORIES.includes(name) is how a
  // House Rent/Room Rent entry is told apart from any other income category
  // elsewhere in the file (TODO-56 - name-based, not isShared-based, since
  // plain House Rent entries carry no isShared field at all).
  const [incomeSources, setIncomeSources] = useState(config.incomeSources ?? []);
  // TODO-90: annual % growth applied only to Salary/Wages income sources,
  // compounding monthly from simulation month 1 - independent of any other
  // growth rate in this app (inflation, savings, property). 0 (default)
  // means every existing scenario behaves byte-for-byte identically.
  // TODO-106: 3% p.a. - roughly tracks recent AU Wage Price Index growth.
  const [salaryGrowthRate, setSalaryGrowthRate] = useState(legacyFlatBaseline ? 0 : (config.salaryGrowthRate ?? 3));
  // TODO-91: annual % growth applied only to rental income sources (House
  // Rent/Room Rent), independent of salaryGrowthRate - rent and wages move
  // on their own schedules. 0 (default) means every existing scenario
  // behaves byte-for-byte identically.
  // TODO-106: 3% p.a. - broadly tracks general income/inflation trends.
  const [rentGrowthRate, setRentGrowthRate] = useState(legacyFlatBaseline ? 0 : (config.rentGrowthRate ?? 3));
  // TODO-95: weeks/year a rental property sits vacant, applied as a flat
  // deterministic average haircut on rental income (e.g. 2 weeks -> ~3.8%
  // reduction) - not a random/stochastic event, keeps this app's fully
  // deterministic design intact. 0 (default) means every existing
  // scenario behaves byte-for-byte identically.
  // TODO-106: 2 weeks/year - a commonly used "healthy rental market"
  // planning assumption.
  const [vacancyWeeksPerYear, setVacancyWeeksPerYear] = useState(legacyFlatBaseline ? 0 : (config.vacancyWeeksPerYear ?? 2));
  // TODO-94: flat % converting any income source marked "Gross" (below) to
  // net, everywhere income is read - covers salaried people who only know
  // their gross figure, and non-PAYG income (self-employment/dividends/
  // bonus) via the same mechanism. 0 (default) means every existing
  // scenario behaves byte-for-byte identically.
  // TODO-106: 20% - a rounded typical AVERAGE (not marginal) tax rate for a
  // middle-income earner. Fixed constant, not derived from entered income -
  // deriving it would reintroduce the complexity-budget problem TODO-94
  // already rejected for real AU tax brackets.
  const [effectiveTaxRate, setEffectiveTaxRate] = useState(legacyFlatBaseline ? 0 : (config.effectiveTaxRate ?? 20));
  const [showIncome, setShowIncome] = useState(config.showIncome ?? false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [newIncomeCategory, setNewIncomeCategory] = useState('Salary/Wages'); // see INCOME_CATEGORIES (src/calculations/incomeCategories.js)
  const [newIncomeCustomName, setNewIncomeCustomName] = useState(''); // only used when category is 'Other'
  const [newIncomeAmount, setNewIncomeAmount] = useState(config.newIncomeAmount);
  const [newIncomeIsShared, setNewIncomeIsShared] = useState(false); // only used when category is 'Room Rent'
  const [newIncomeIsGross, setNewIncomeIsGross] = useState(false); // TODO-94: pre-tax amount, needs effectiveTaxRate to convert to net
  const [newIncomeNumPeople, setNewIncomeNumPeople] = useState(2); // only used when category is 'Room Rent' and shared
  const incomeSchedule = useScheduleForm();

  // TODO-141: replaces the old realisticModeEnabled banner trigger. A flat
  // baseline is now a real state the user can choose (every assumption at
  // 0) rather than a mode, so the Loan Simulation note describes what the
  // numbers ARE instead of which switch is off. Deliberately excludes
  // propertyGrowthRate and inflationRate: neither changes payoff time or
  // total interest (property growth only feeds propertyValue inside
  // offsetSimulation.js, and inflation is applied after the simulation per
  // TODO-93), so they'd make this claim wrong in both directions.
  const projectionIsFlatBaseline =
    salaryGrowthRate === 0 &&
    rentGrowthRate === 0 &&
    expenseGrowthRate === 0 &&
    vacancyWeeksPerYear === 0 &&
    effectiveTaxRate === 0;

  // TODO-102: "Advanced Assumptions" auto-expands whenever something
  // inside it has already been customized away from its inert default -
  // a returning user should never lose visibility into settings they've
  // actually set, even if they (or a loaded scenario) left the section
  // collapsed. OR'd with the raw toggle rather than baked into its
  // useState initializer - no precedent in this file for a useState
  // initializer reading sibling state, and this keeps the raw toggle
  // (what onClick flips, what persists) separate from the derived
  // "is it actually showing" value used for rendering.
  // TODO-109/141: Expense Growth Rate/Inflation Rate and the rest of the
  // assumption family moved out into their own dedicated "Projection
  // Assumptions" card. TODO-137: the ETF family likewise moved out into
  // "Extra Investments & Strategies". So this check now only covers what's
  // genuinely left behind in Financial Position.
  const financialPositionAdvancedCustomized =
    savingsInterestRate !== 0 || useCreditCard || showMortgageFreeAge;
  const financialPositionAdvancedExpanded = showFinancialPositionAdvanced || financialPositionAdvancedCustomized;

  // Your personal expenses
  const [showPersonalExpenses, setShowPersonalExpenses] = useState(config.showPersonalExpenses ?? false);
  // Results panel: collapses the Monthly Expenses card's "Personal Expenses"
  // row into its per-item sub-rows, same "breakdown" pattern as Property
  // Expenses (TODO-39) - distinct from showPersonalExpenses above, which
  // controls the separate "Your Personal Expenses" input card.
  const [showPersonalExpensesBreakdown, setShowPersonalExpensesBreakdown] = useState(config.showPersonalExpensesBreakdown ?? false);

  // Collapsed by default (TODO-65) - the chart components only mount while
  // this is true (conditional JSX, not just conditional CSS visibility), so
  // recharts' actual render work only happens while the card is open.
  const [showProgressCharts, setShowProgressCharts] = useState(config.showProgressCharts ?? false);

  // Offset contributions state. Same Schedule shape as Income Sources/
  // Exceptional Expenses ({startMonth, recurrence, endMonth}), resolved the
  // same way via getActiveAmount/isScheduleActive - a contribution can now
  // recur (e.g. "$500 every quarter") instead of only ever being a single
  // lump sum.
  const [offsetContributions, setOffsetContributions] = useState(config.offsetContributions ?? []);
  // TODO-115: Offset Contributions moved into its own top-level card,
  // separate from showPersonalExpenses - it's a mortgage-offset feature,
  // not a personal expense, and never had a real reason to share a toggle
  // with one.
  const [showOffsetContributions, setShowOffsetContributions] = useState(config.showOffsetContributions ?? false);
  const [showAddContribution, setShowAddContribution] = useState(false);
  // Contributions default to one-time (unlike Income/Expenses, which default
  // to recurring) - preserves the pre-TODO-32 behavior where every
  // contribution was a single lump sum, with recurring now opt-in.
  const contribSchedule = useScheduleForm({ oneTime: true });
  const [newContribAmount, setNewContribAmount] = useState(config.newContribAmount);

  // Personal Expenses State (TODO-66, merged with the former "Other
  // Expenses" section in TODO-85) - an addable/removable list, covering
  // routine recurring costs (Groceries, Transport, Phone/Internet - seeded
  // as starter items in config.default.json), distinct-lifecycle costs
  // (a subscription starts and gets cancelled) and one-off/exceptional
  // costs (a wedding, car repair). Same direct-per-occurrence-dollar-amount
  // convention as every other Schedule-shaped list in this file (not a
  // $/week rate).
  const [personalExpenseItems, setPersonalExpenseItems] = useState(config.personalExpenseItems ?? []);
  const [showAddExceptExp, setShowAddExceptExp] = useState(false);
  const [newExpCategory, setNewExpCategory] = useState('Groceries'); // see PERSONAL_EXPENSE_CATEGORIES
  const [newExpCustomName, setNewExpCustomName] = useState(''); // only used when category is 'Custom'
  const [newExpAmount, setNewExpAmount] = useState(config.newExpAmount);
  const expenseSchedule = useScheduleForm();

  // Timeline Explorer State
  const [timelineMonth, setTimelineMonth] = useState(0);

  // Whether the current inputs are backed by a saved-in-browser scenario -
  // drives the Save/Reset bar's copy and whether "Reset" is even offered.
  const [hasSavedScenario, setHasSavedScenario] = useState(savedScenario !== null);
  // savedAt travels inside the scenario payload itself (just another field,
  // like propertyPrice) rather than as separate storage-envelope metadata -
  // no changes needed to scenarioStorage.js's save/load/parse functions.
  const [lastSavedAt, setLastSavedAt] = useState(savedScenario?.savedAt ?? null);

  // Calculate total scheduled offset contributions. Only one-time
  // contributions count toward this total (see calculateTotalScheduledOffset)
  // - split out separately here since the recurring count needs its own
  // wording ("recurring contribution", not "lump sum payment").
  const totalScheduledOffset = calculateTotalScheduledOffset(offsetContributions);
  const oneTimeContributionsCount = offsetContributions.filter(c => c.recurrence === 'none').length;
  const recurringContributionsCount = offsetContributions.length - oneTimeContributionsCount;

  // Loan calculations
  const loanAmount = calculateLoanAmount(propertyPrice, downPayment);
  const lvr = safePercentage(loanAmount, propertyPrice);
  // Current ("month 1") rate - same convention as every other stepped field
  // (Strata/Utilities/etc) and Income Sources/Tenants: a scheduled change
  // that hasn't kicked in yet shouldn't affect what these static figures
  // show right now. The simulation below resolves the rate itself, monthly,
  // via interestRateField directly (TODO-57).
  const interestRate = getSteppedValue(interestRateField.base, interestRateField.changes, 1);
  const monthlyRate = calculateMonthlyRate(interestRate);
  const totalMonths = loanTermYears * 12;
  const monthlyPayment = calculateMonthlyPayment(loanAmount, monthlyRate, totalMonths);

  // TODO-55: a static, non-simulation estimate of the benefit from using a
  // credit card (paid off in full every month) instead of debit for
  // eligible spending - reuses the loan's own interestRate rather than a
  // separate rate input, since the money in question is money that would
  // otherwise leave the offset immediately.
  const offsetTimingBenefit = calculateOffsetTimingBenefit(monthlyCardSpend, avgExtraDaysHeld, interestRate);
  const cardCashback = calculateCardCashback(monthlyCardSpend, cashbackPct, annualCardFee);
  const creditCardNetBenefit = offsetTimingBenefit + cardCashback;

  // Upfront costs of buying - stamp duty/surcharge are state-specific
  // (src/calculations/states/), LMI isn't (see nsw.js's own comment on why).
  const stampDuty = stateModule.calculateStampDuty(propertyPrice, isFirstHomeBuyer);
  const foreignPurchaserSurcharge = stateModule.calculateForeignPurchaserSurcharge(propertyPrice, isForeignPurchaser);
  const lmi = estimateLmi(loanAmount, lvr);
  const closingCostsSubtotal = sumClosingCosts([
    conveyancing,
    buildingInspection,
    pestInspection,
    registrationFees,
    searches,
    loanEstablishmentFee,
    propertyValuation,
    homeInsurance,
    rateAdjustments,
    miscUpfrontCost,
  ]);
  const totalCashRequired = calculateTotalCashRequired({
    downPayment,
    stampDuty,
    foreignPurchaserSurcharge,
    closingCostsSubtotal,
    lmi,
    payLmiUpfront,
  });
  // Scheduled offset contributions draw from the same savings pool as the
  // deposit and upfront costs - without this, a $250k deposit and a $250k
  // month-1 contribution could both look affordable in isolation.
  const cashRemaining = calculateCashRemaining({ totalSavings, totalCashRequired, totalScheduledOffset });

  // Everything still owned and reachable at settlement, bank + offset. The
  // Emergency/Vacancy Buffers use this rather than cashRemaining: committing
  // cash to the offset doesn't spend it, and the simulation itself drains the
  // offset first to cover a deficit month, so subtracting it would contradict
  // the engine and understate how long the buyer could actually last.
  const liquidSavings = calculateLiquidSavings({ totalSavings, totalCashRequired });

  // Current ("month 1") value of each expense field - same convention as
  // tenants: a scheduled change that hasn't kicked in yet shouldn't affect
  // what these recurring-situation cards show right now.
  // Strata only exists for units/apartments on a shared title - a house has
  // none, regardless of whatever value is stored (see handlePropertyTypeChange).
  const strataFees = propertyType === 'house' ? 0 : getSteppedValue(strataFeesField.base, strataFeesField.changes, 1);
  const utilities = getSteppedValue(utilitiesField.base, utilitiesField.changes, 1);
  const councilRates = getSteppedValue(councilRatesField.base, councilRatesField.changes, 1);
  const insurance = getSteppedValue(insuranceField.base, insuranceField.changes, 1);
  const maintenance = getSteppedValue(maintenanceField.base, maintenanceField.changes, 1);
  const waterRates = getSteppedValue(waterRatesField.base, waterRatesField.changes, 1);
  // Land Tax/Property Management only apply to an investment property,
  // regardless of whatever value is stored (see handleInvestmentPropertyChange).
  const landTax = isInvestmentProperty ? getSteppedValue(landTaxField.base, landTaxField.changes, 1) : 0;
  const propertyManagement = isInvestmentProperty
    ? getSteppedValue(propertyManagementField.base, propertyManagementField.changes, 1)
    : 0;
  const miscPropertyExpense = getSteppedValue(miscPropertyExpenseField.base, miscPropertyExpenseField.changes, 1);

  // Monthly property expenses
  const monthlyStrata = calculateMonthlyStrata(strataFees);
  const monthlyCouncil = calculateMonthlyCouncil(councilRates);
  const monthlyWaterRates = calculateMonthlyWaterRates(waterRates);
  const monthlyLandTax = calculateMonthlyLandTax(landTax);
  const monthlyPropertyExpenses = calculateMonthlyPropertyExpenses({
    monthlyStrata, utilities, monthlyCouncil, insurance,
    maintenance, monthlyWaterRates, monthlyLandTax, propertyManagement, miscPropertyExpense,
  });
  const totalPropertyCost = calculateTotalPropertyCost(monthlyPayment, monthlyPropertyExpenses);

  // Interest on the full balance, before any offset is applied.
  // This is the Timeline Explorer's "month 0" figure: nothing has happened yet,
  // so it must stay consistent with that snapshot's offset: 0 / effectiveBalance: loanAmount.
  const monthZeroInterest = calculateInitialMonthlyInterest(loanAmount, monthlyRate);

  // Your personal expenses (TODO-66, merged with the former "Other
  // Expenses" in TODO-85) - same "right now" (month 1) convention as
  // Income Sources; weeklyPersonalExpenses is only kept around for
  // calculateWeeklyNetBalance's own weekly-denominated math below, via the
  // 12/52 inverse of the usual weekly->monthly factor.
  const monthlyPersonalExpenses = getActiveAmount(personalExpenseItems, 1);
  const weeklyPersonalExpenses = monthlyPersonalExpenses * 12 / 52;

  // Total cash flow. Same "right now" (month 1) convention as exceptional
  // expenses - an income source that hasn't started yet, or already ended,
  // shouldn't count here. House Rent/Room Rent (RENTAL_INCOME_CATEGORIES)
  // live inside incomeSources like any other entry - this just partitions
  // the same array into the two subtotals the rest of the app already
  // expects, instead of drawing from two separate arrays.
  const weeklyIncome = getActiveAmount(incomeSources.filter(i => !RENTAL_INCOME_CATEGORIES.includes(i.name)), 1, effectiveTaxRate);
  const weeklyRentalIncome = getActiveAmount(incomeSources.filter(i => RENTAL_INCOME_CATEGORIES.includes(i.name)), 1, effectiveTaxRate);
  const monthlyIncome = calculateMonthlyFromWeekly(weeklyIncome);
  const monthlyRentalIncome = calculateMonthlyFromWeekly(weeklyRentalIncome);

  // TODO-122: a suggested Effective Tax Rate from real ATO brackets and the
  // user's own Gross-marked income. Display only - nothing here feeds the
  // simulation, which still reads the flat effectiveTaxRate slider and nothing
  // else. null when no income is marked Gross (see the hint below the slider).
  const taxSuggestion = getSuggestedTaxRate(incomeSources);
  const suggestedTaxRate = taxSuggestion === null ? null : Math.round(taxSuggestion.suggestedRatePct);
  // TODO-127: purely informational (no "apply" button) - there is only one
  // global effectiveTaxRate, so there is no control this figure could ever be
  // applied to without overstating tax on the rest of the user's income.
  const marginalRentalRate = getMarginalRentalTaxRate(incomeSources);

  // NET WEEKLY/MONTHLY BALANCE
  // Logic: (Personal Income + Rental Income) - (Personal Expenses + Property Expenses)
  const monthlyNetBalance = calculateMonthlyNetBalance(monthlyIncome, monthlyRentalIncome, monthlyPersonalExpenses, totalPropertyCost);
  const weeklyNetBalance = calculateWeeklyNetBalance(weeklyIncome, weeklyRentalIncome, weeklyPersonalExpenses, totalPropertyCost);
  const fortnightlyNetBalance = calculateFortnightlyNetBalance(weeklyNetBalance);

  // What you can deposit to offset. These stay based on the "right now" rental
  // figure above - they're the recurring-situation display, not the simulation.
  const monthlyToOffset = calculateMonthlyToOffset(monthlyNetBalance);
  const weeklyToOffset = calculateWeeklyToOffset(weeklyNetBalance);
  const fortnightlyToOffset = calculateFortnightlyToOffset(fortnightlyNetBalance);

  // Surplus feeding the simulation, EXCLUDING personal income, tenant rent,
  // and the 7 expense fields, left unclamped. The loop adds/subtracts each of
  // those back in per month instead, since any of them can now change
  // mid-simulation and so can no longer be pre-collapsed into a single
  // constant - clamping here first would lose information once they're
  // summed in afterwards (see offsetSimulation.js).
  const baseMonthlySurplus = calculateMonthlyNetBalance(0, 0, 0, monthlyPayment);

  const expenseFields = {
    // A house has no strata for the whole simulation, no matter what's
    // stored in strataFeesField - matches the static strataFees value above.
    strataFees: propertyType === 'house' ? { base: 0, changes: [] } : strataFeesField,
    utilities: utilitiesField,
    councilRates: councilRatesField,
    insurance: insuranceField,
    maintenance: maintenanceField,
    waterRates: waterRatesField,
    // Land Tax/Property Management only apply for the whole simulation when
    // the property is marked as an investment - matches the static landTax/
    // propertyManagement values above.
    landTax: isInvestmentProperty ? landTaxField : { base: 0, changes: [] },
    propertyManagement: isInvestmentProperty ? propertyManagementField : { base: 0, changes: [] },
    miscPropertyExpense: miscPropertyExpenseField,
  };

  // TODO-96/126: the ETF checkbox is disabled at effectiveTaxRate
  // === 0 (see the JSX below), and the master visibility switch also pauses
  // the effect without deleting the child settings. This re-derived flag -
  // not the raw useEtfInvesting state - is what actually controls ETF
  // simulation/output, so disabling the master or tax interaction stays
  // honest regardless of how it happened. The tax-rate condition survives
  // TODO-141's removal of the old master gate: comparing a pre-tax ETF
  // return against the offset's tax-free return is dishonest whatever put
  // the rate at 0. It just fires rarely now that the rate defaults to 20
  // instead of being forced to 0 by a mode switch.
  const etfInvestingActive = showEtfInvestingOptions && useEtfInvesting && effectiveTaxRate > 0;

  // Complete loan simulation with offset. maxMonths must match the chosen
  // term explicitly - otherwise the loop would keep the old 30-year cap
  // baked into offsetSimulation.js's default, inconsistent with a shorter
  // term's monthlyPayment.
  const loanSimulation = calculateLoanWithOffset({
    contributions: offsetContributions,
    personalExpenseItems,
    incomeSources,
    expenseFields,
    monthlyToOffset: baseMonthlySurplus,
    loanAmount,
    monthlyRate,
    monthlyPayment,
    interestRateField,
    initialSavingsBalance: cashRemaining,
    savingsInterestRate,
    propertyPrice,
    propertyGrowthRate: propertyGrowthRate,
    salaryGrowthRate: salaryGrowthRate,
    rentGrowthRate: rentGrowthRate,
    vacancyWeeksPerYear: vacancyWeeksPerYear,
    expenseGrowthRate: expenseGrowthRate,
    effectiveTaxRate: effectiveTaxRate,
    isInvestmentProperty,
    etfAllocationPct: etfInvestingActive ? etfAllocationPct : 0,
    expectedEtfReturn,
    switchThresholdPct: effectiveSwitchThresholdPct,
    etfStartMonth: effectiveEtfStartMonth,
    etfReserveMonths: effectiveEtfReserveMonths,
    maxMonths: totalMonths,
  });
  const baselineSimulation = calculateLoanWithOffset({
    contributions: [], // No offsets
    personalExpenseItems,
    incomeSources,
    expenseFields,
    monthlyToOffset: baseMonthlySurplus,
    loanAmount,
    monthlyRate,
    monthlyPayment,
    interestRateField,
    initialSavingsBalance: cashRemaining,
    savingsInterestRate,
    propertyPrice,
    propertyGrowthRate: propertyGrowthRate,
    salaryGrowthRate: salaryGrowthRate,
    rentGrowthRate: rentGrowthRate,
    vacancyWeeksPerYear: vacancyWeeksPerYear,
    expenseGrowthRate: expenseGrowthRate,
    effectiveTaxRate: effectiveTaxRate,
    isInvestmentProperty,
    etfAllocationPct: etfInvestingActive ? etfAllocationPct : 0,
    expectedEtfReturn,
    switchThresholdPct: effectiveSwitchThresholdPct,
    etfStartMonth: effectiveEtfStartMonth,
    etfReserveMonths: effectiveEtfReserveMonths,
    maxMonths: totalMonths,
  });
  const interestSaved = baselineSimulation.totalInterest - loanSimulation.totalInterest;

  // TODO-93: "Total interest paid" in today's dollars - a pure display-layer
  // read of loanSimulation's own monthlyData, discounting each month's
  // actual interest payment individually rather than the aggregate by a
  // single power-of-years factor (interest is paid gradually, not as one
  // lump sum at the end). Nothing about the simulation itself changes.
  const totalInterestInTodaysDollars = calculatePresentValueOfInterest(loanSimulation.monthlyData, inflationRate);

  // First month of the simulation. Taken from the simulation itself so it accounts for
  // everything the loop does in month 1: any scheduled lump sum, the recurring monthly
  // surplus, and exceptional expenses. Falls back to the un-offset figure when the
  // simulation can't run (no surplus and no contributions -> monthlyData is empty).
  const firstMonth = loanSimulation.monthlyData[0];
  const firstMonthInterest = firstMonth?.monthlyInterestPaid ?? Math.round(monthZeroInterest);
  const firstMonthOffset = firstMonth?.offset ?? 0;

  // Total interest on a plain 30-year loan with no offset at all, used as the
  // comparison baseline in the savings card.
  const noOffsetTotalInterest = calculateNoOffsetTotalInterest(monthlyPayment, loanAmount, totalMonths);

  // Share of income consumed by expenses, driving the Total Summary donut.
  // With no income at all, everything is consumed - falling back to 0 would
  // paint a reassuring all-green ring for someone earning nothing.
  const expenseRatio = Math.min(
    100,
    safePercentage(totalPropertyCost + monthlyPersonalExpenses, monthlyIncome + monthlyRentalIncome, 100)
  );

  // Purchase Health Check panel (TODO-68/69/70) - all "month 1"/"right now"
  // snapshots, same convention as every other static figure on this page.
  // TODO-134: six of these also get a "Stabilized" reading - the month the
  // last scheduled income/expense/rate change fires (or year 5 if nothing is
  // scheduled), with growth applied - computed independently of the loan
  // simulation (see projectedHealthCheck.js for why). Resolved once, shared
  // by every indicator below.
  const stabilizationMonth = findStabilizationMonth({ incomeSources, personalExpenseItems, expenseFields, interestRateField });
  const projected = resolveProjectedFinancials(stabilizationMonth, {
    incomeSources, personalExpenseItems, expenseFields, interestRateField,
    effectiveTaxRate, salaryGrowthRate, rentGrowthRate, expenseGrowthRate, vacancyWeeksPerYear,
    loanAmount, monthlyPayment, interestRate, totalMonths,
  });
  const projectedTotalPropertyCost = calculateTotalPropertyCost(projected.monthlyPayment, projected.monthlyPropertyExpenses);

  const emergencyBufferMonths = calculateEmergencyBufferMonths(liquidSavings, totalPropertyCost + monthlyPersonalExpenses);
  // Twist (per TODO-134): the numerator (liquidSavings, a settlement-day
  // figure) stays fixed for both readings - only the denominator moves. That
  // alone is what makes the Stabilized buffer grow as income outpaces
  // expenses, with no need to model an accumulating savings balance.
  const stabilizedEmergencyBufferMonths = calculateEmergencyBufferMonths(liquidSavings, projectedTotalPropertyCost + projected.monthlyPersonalExpenses);
  const emergencyBufferClass = classifyEmergencyBuffer(worseOf(emergencyBufferMonths, stabilizedEmergencyBufferMonths, 'higherIsBetter'));

  const housingCostRatio = calculateHousingCostRatio(totalPropertyCost, monthlyIncome + monthlyRentalIncome);
  const stabilizedHousingCostRatio = calculateHousingCostRatio(projectedTotalPropertyCost, projected.monthlyIncome + projected.monthlyRentalIncome);
  const housingCostRatioClass = classifyHousingCostRatio(worseOf(housingCostRatio, stabilizedHousingCostRatio, 'higherIsWorse'));

  const stressTestSurvivedDelta = calculateStressTestSurvivedDelta({
    loanAmount, interestRate, totalMonths, monthlyPropertyExpenses,
    monthlyIncome, monthlyRentalIncome, monthlyPersonalExpenses,
  });
  // Same original loanAmount/totalMonths as Day 1 (never the offset-reduced
  // balance - that's the simulation's concern, kept out of this calculation
  // entirely), but the rate/payment reflect whatever's scheduled by the
  // Stabilized month.
  const stabilizedStressTestSurvivedDelta = calculateStressTestSurvivedDelta({
    loanAmount, interestRate: projected.interestRate, totalMonths, monthlyPropertyExpenses: projected.monthlyPropertyExpenses,
    monthlyIncome: projected.monthlyIncome, monthlyRentalIncome: projected.monthlyRentalIncome, monthlyPersonalExpenses: projected.monthlyPersonalExpenses,
  });
  const stressTestClass = classifyStressTest(worseOf(stressTestSurvivedDelta, stabilizedStressTestSurvivedDelta, 'higherIsBetter'));
  // TODO-148: whether cash flow is ALREADY negative at the rate each reading
  // actually tests (today's for Day-1, the Stabilized month's projected rate
  // for that reading) - reuses monthlyNetBalance (already computed above) and
  // the same calculateMonthlyNetBalance call for the Stabilized figures, no new
  // calculation.
  const alreadyInDeficitAtCurrentRate = monthlyNetBalance < 0;
  const stabilizedNetBalance = calculateMonthlyNetBalance(projected.monthlyIncome, projected.monthlyRentalIncome, projected.monthlyPersonalExpenses, projectedTotalPropertyCost);
  const stabilizedAlreadyInDeficit = stabilizedNetBalance < 0;

  const upfrontCostRatio = calculateUpfrontCostRatio(totalCashRequired, downPayment, propertyPrice);
  const upfrontCostRatioClass = classifyUpfrontCostRatio(upfrontCostRatio);

  // State-agnostic (per TODO-58) - reacts to the ALREADY-computed stampDuty
  // output rather than hardcoding any state's concession thresholds here.
  const fhbConcessionLost = isFirstHomeBuyer && stampDuty > 0;

  // TODO-69: investment-property-only indicators.
  const gearingCashflow = monthlyRentalIncome - monthlyPayment - monthlyPropertyExpenses;
  const stabilizedGearingCashflow = projected.monthlyRentalIncome - projected.monthlyPayment - projected.monthlyPropertyExpenses;
  const gearingClass = classifyGearing(worseOf(gearingCashflow, stabilizedGearingCashflow, 'higherIsBetter'));

  const vacancyBufferMonths = calculateVacancyBufferMonths(liquidSavings, monthlyPayment + monthlyPropertyExpenses);
  const stabilizedVacancyBufferMonths = calculateVacancyBufferMonths(liquidSavings, projected.monthlyPayment + projected.monthlyPropertyExpenses);
  const vacancyBufferClass = classifyVacancyBuffer(worseOf(vacancyBufferMonths, stabilizedVacancyBufferMonths, 'higherIsBetter'));

  const rentalYieldHasData = hasEnoughDataForRentalYield(weeklyRentalIncome);
  const rentalYield = calculateRentalYield(weeklyRentalIncome, propertyPrice);
  // Inverse of calculateMonthlyFromWeekly (weekly * 52 / 12) - no dedicated
  // helper exists, and adding one for this single call site isn't warranted.
  const stabilizedWeeklyRentalIncome = projected.monthlyRentalIncome * 12 / 52;
  const stabilizedRentalYield = calculateRentalYield(stabilizedWeeklyRentalIncome, propertyPrice);
  const rentalYieldClass = rentalYieldHasData ? classifyRentalYield(worseOf(rentalYield, stabilizedRentalYield, 'higherIsBetter')) : null;

  // TODO-88: Mortgage-Free Age is opt-in via showMortgageFreeAge, rather than
  // overloading currentAge itself as a "not provided" sentinel.
  const mortgageFreeAge = showMortgageFreeAge ? calculateMortgageFreeAge(currentAge, loanSimulation.years) : null;
  const mortgageFreeAgeClass = mortgageFreeAge !== null ? classifyMortgageFreeAge(mortgageFreeAge) : null;

  const healthCheckHasCritical = fhbConcessionLost || [emergencyBufferClass, housingCostRatioClass, stressTestClass, upfrontCostRatioClass].some((c) => c.critical);

  // TODO-135: Simple mode's roll-up line. A re-reading of figures and
  // classifications Simple already displays underneath it - no new threshold.
  const affordability = summariseAffordability({
    cashRemaining, monthlyNetBalance, emergencyBufferClass, housingCostRatioClass,
  });

  // TODO-135: Simple hides these editors but the model still applies them, so
  // it has to say so. Only features that genuinely move a figure Simple SHOWS
  // are listed - being vague here would be worse than saying nothing.
  const activeAdvancedFeatures = [
    etfInvestingActive && etfAllocationPct > 0 && 'ETF investing',
    totalScheduledOffset > 0 && 'scheduled offset contributions',
    interestRateField.changes.length > 0 && 'a scheduled interest-rate change',
    Object.values(expenseFields).some((f) => f.changes.length > 0) && 'scheduled property-expense changes',
    useCreditCard && 'credit-card modelling',
  ].filter(Boolean);

  // Invariant: downPayment never exceeds propertyPrice, enforced in both
  // directions. Without this, lowering the price below the current deposit
  // leaves a stale deposit behind (the range input clamps its own display but
  // never fires onChange), producing a negative loan and a negative payment.
  // React batches both setState calls into a single re-render.
  const handlePropertyPriceChange = (nextPrice) => {
    setPropertyPrice(nextPrice);
    if (downPayment > nextPrice) setDownPayment(nextPrice);
  };

  const handleDownPaymentChange = (nextDeposit) => {
    setDownPayment(clampToRange(nextDeposit, 0, propertyPrice));
  };

  // loanAmount stays a derived value (calculateLoanAmount) - editing it here
  // just translates the edit into a new downPayment, so propertyPrice/
  // downPayment/loanAmount can never drift out of sync with each other.
  const handleLoanAmountChange = (nextLoanAmount) => {
    const clamped = clampToRange(nextLoanAmount, 0, propertyPrice);
    setDownPayment(propertyPrice - clamped);
  };

  // Houses have no strata (it only exists on a shared title). Switching to
  // "unit" gives strata a sensible non-zero starting point if it's still at
  // the house default of $0 - switching to "house" doesn't touch the stored
  // value at all, since it's simply ignored (zeroed at the calculation level
  // and hidden from the UI) rather than cleared, in case the user switches back.
  const handlePropertyTypeChange = (nextType) => {
    setPropertyType(nextType);
    if (nextType === 'unit' && strataFeesField.base === 0) {
      strataFeesField.setBase(1000);
    }
  };

  // Same "seed a sensible default" pattern as handlePropertyTypeChange above -
  // switching investment status on gives Land Tax/Property Management a
  // non-zero starting point if they're still at 0; switching off doesn't
  // touch the stored values, since they're simply zeroed at the calculation
  // level and hidden from the UI, in case the user switches back.
  // In NSW the First Home Buyer stamp duty concession requires occupying the
  // property, which an investment property by definition isn't - switching
  // investment on forces FHB off (and the checkbox disables, see its JSX) so
  // the two can't be ticked together; switching investment back off doesn't
  // re-tick FHB, since that's a decision only the user should make.
  const handleInvestmentPropertyChange = (checked) => {
    setIsInvestmentProperty(checked);
    if (checked) {
      setIsFirstHomeBuyer(false);
      if (landTaxField.base === 0) landTaxField.setBase(2000);
      if (propertyManagementField.base === 0) propertyManagementField.setBase(150);
    }
  };

  // Symmetric to handleInvestmentPropertyChange above - checking First Home
  // Buyer forces Investment Property off too, since the same real-world
  // exclusivity applies from either direction (see that checkbox's
  // `disabled={isFirstHomeBuyer}` in the JSX).
  const handleFirstHomeBuyerChange = (checked) => {
    setIsFirstHomeBuyer(checked);
    if (checked) {
      setIsInvestmentProperty(false);
    }
  };

  // Only the ~24 "data" inputs are saved - ephemeral UI state (collapsed
  // sections, in-progress "Add" form drafts, the Timeline Explorer's
  // selected month) isn't part of a scenario.
  const handleSaveScenario = () => {
    const savedAt = Date.now();
    const scenario = {
      // TODO-141: realisticModeEnabled is deliberately NOT saved - the gate
      // it controlled no longer exists. Old scenarios that still carry it
      // are read once on load (see legacyFlatBaseline) and stop carrying it
      // the moment they're re-saved from here.
      propertyPrice, propertyGrowthRate, propertyType, downPayment, loanTermYears,
      interestRate: interestRateField.base, interestRateChanges: interestRateField.changes,
      strataFees: strataFeesField.base, strataFeesChanges: strataFeesField.changes,
      utilities: utilitiesField.base, utilitiesChanges: utilitiesField.changes,
      councilRates: councilRatesField.base, councilRatesChanges: councilRatesField.changes,
      insurance: insuranceField.base, insuranceChanges: insuranceField.changes,
      maintenance: maintenanceField.base, maintenanceChanges: maintenanceField.changes,
      waterRates: waterRatesField.base, waterRatesChanges: waterRatesField.changes,
      isInvestmentProperty,
      landTax: landTaxField.base, landTaxChanges: landTaxField.changes,
      propertyManagement: propertyManagementField.base, propertyManagementChanges: propertyManagementField.changes,
      miscPropertyExpense: miscPropertyExpenseField.base, miscPropertyExpenseChanges: miscPropertyExpenseField.changes,
      isFirstHomeBuyer, isForeignPurchaser, totalSavings, savingsInterestRate, expenseGrowthRate, currentAge, showMortgageFreeAge, payLmiUpfront,
      useCreditCard, monthlyCardSpend, avgExtraDaysHeld, cashbackPct, annualCardFee, inflationRate,
      showEtfInvestingOptions, showOpportunityCost, expectedEtfReturn, useEtfInvesting, etfAllocationPct, switchThresholdPct,
      // TODO-144: purely additive, so no SCHEMA_VERSION bump - an older
      // scenario without these falls through to the same no-op defaults, and
      // etfStartTrigger is re-derived from them on load rather than stored.
      etfStartMonth, etfReserveMonths, etfCrashMonth,
      conveyancing, buildingInspection, pestInspection, registrationFees, searches,
      loanEstablishmentFee, propertyValuation, homeInsurance, rateAdjustments, miscUpfrontCost,
      incomeSources,
      salaryGrowthRate,
      rentGrowthRate,
      vacancyWeeksPerYear,
      effectiveTaxRate,
      offsetContributions,
      personalExpenseItems,
      showPropertyExpenses, showMonthlyExpensesBreakdown, showClosingCostsBreakdown,
      showIncome, showFinancialPositionAdvanced,
      showPersonalExpenses, showPersonalExpensesBreakdown, showOffsetContributions, showProgressCharts, showHealthCheck,
      showProjectionAssumptions, showExtraInvestments,
      savedAt,
    };
    if (saveScenario(scenario)) {
      setHasSavedScenario(true);
      setLastSavedAt(savedAt);
    } else {
      alert('Could not save - your browser may be blocking local storage (e.g. private browsing).');
    }
  };

  const handleClearSavedScenario = () => {
    if (!window.confirm('Clear your saved scenario and reset to defaults?')) return;
    clearScenario();
    // Reloading lets the normal (now scenario-less) initialization flow reset
    // all ~24 pieces of state at once, instead of duplicating every default
    // here a second time.
    window.location.reload();
  };

  // Functions for managing offset contributions
  const addOffsetContribution = () => {
    if (!validateAmount(newContribAmount)) return;
    if (!contribSchedule.validateRange()) return;

    // Only guards against two one-time lump sums landing on the exact same
    // month - two independent recurring contributions starting on the same
    // month aren't a conflict the way two one-time lumps in the same month are.
    if (contribSchedule.oneTime && hasDuplicateOneTimeMonth(offsetContributions, contribSchedule.startMonth)) {
      alert('A contribution already exists for this month. Please remove it first or choose a different month.');
      return;
    }

    const newContrib = {
      id: Date.now(),
      amount: newContribAmount,
      ...contribSchedule.schedule,
    };

    const updatedContributions = [...offsetContributions, newContrib].sort((a, b) => a.startMonth - b.startMonth);
    setOffsetContributions(updatedContributions);
    setShowAddContribution(false);
    setNewContribAmount(10000);
    contribSchedule.reset({ startMonth: getNextSuggestion(updatedContributions) });
  };

  const removeOffsetContribution = (id) => {
    const updatedContributions = offsetContributions.filter(c => c.id !== id);
    setOffsetContributions(updatedContributions);
    // Only the suggested month moves - deliberately not a full reset(), which
    // would also wipe recurrence/End Month out from under an add-form the user
    // may have open and half-configured.
    contribSchedule.setStartMonth(getNextSuggestion(updatedContributions));
  };

  // Income Sources Functions

  // Applies each category's default Schedule (INCOME_CATEGORY_DEFAULTS) when
  // the user picks a new Income Name, so e.g. a Bonus starts as one-time and
  // a Salary starts as Monthly/Forever, instead of the form always defaulting
  // the same way regardless of category. Only the Schedule fields move - Room
  // Rent's own Shared Room fields (isShared/numPeople) are untouched. See
  // useScheduleForm's applyDefaults for what an omitted field means.
  const handleIncomeCategoryChange = (category) => {
    setNewIncomeCategory(category);
    incomeSchedule.applyDefaults(INCOME_CATEGORY_DEFAULTS[category]);
  };

  const addIncomeSource = () => {
    const isRoomRent = newIncomeCategory === 'Room Rent';
    const name = newIncomeCategory === 'Other' ? newIncomeCustomName : newIncomeCategory;
    if (!name) {
      alert('Please enter a name for the income source.');
      return;
    }
    if (!validateAmount(newIncomeAmount)) {
      alert('Please enter a valid amount.');
      return;
    }
    if (!incomeSchedule.validateRange()) return;

    const numPeople = isRoomRent && newIncomeIsShared ? newIncomeNumPeople : 1;
    const newIncome = {
      id: Date.now(),
      name,
      // For Room Rent, amount is the computed total (amountPerPerson *
      // numPeople) - getActiveAmount/calculateMonthlyFromWeekly only ever
      // read `amount`, so they don't need to know about the per-person split.
      // Plain House Rent (and every other category) just uses the entered
      // amount directly, same as Salary/Wages etc.
      amount: isRoomRent ? newIncomeAmount * numPeople : newIncomeAmount,
      isGross: newIncomeIsGross,
      ...incomeSchedule.schedule,
      ...(isRoomRent ? { isShared: newIncomeIsShared, numPeople, amountPerPerson: newIncomeAmount } : {}),
    };

    setIncomeSources([...incomeSources, newIncome]);
    setShowAddIncome(false);
    setNewIncomeCategory('Salary/Wages');
    setNewIncomeCustomName('');
    setNewIncomeAmount(config.newIncomeAmount);
    setNewIncomeIsShared(false);
    setNewIncomeNumPeople(2);
    setNewIncomeIsGross(false);
    incomeSchedule.reset();
  };

  const removeIncomeSource = (id) => {
    setIncomeSources(incomeSources.filter(i => i.id !== id));
  };

  // Personal Expenses Functions (TODO-66, merged with the former "Other
  // Expenses" add-form in TODO-85: name is resolved from the selected
  // category, or the free-text custom name when 'Custom' is picked).
  const addPersonalExpense = () => {
    const name = newExpCategory === 'Custom' ? newExpCustomName : newExpCategory;
    if (!name) {
      alert('Please enter a name for the expense.');
      return;
    }
    if (!validateAmount(newExpAmount)) {
      alert('Please enter a valid amount.');
      return;
    }
    if (!expenseSchedule.validateRange()) return;

    const newExp = {
      id: Date.now(),
      name,
      amount: newExpAmount,
      ...expenseSchedule.schedule,
    };

    setPersonalExpenseItems([...personalExpenseItems, newExp]);
    setShowAddExceptExp(false);
    setNewExpCategory('Groceries');
    setNewExpCustomName('');
    setNewExpAmount(config.newExpAmount);
    expenseSchedule.reset();
  };

  const removePersonalExpense = (id) => {
    setPersonalExpenseItems(personalExpenseItems.filter(e => e.id !== id));
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 bg-gradient-to-br from-slate-50 dark:from-slate-900 to-blue-50 dark:to-blue-950">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-3">
            <Home className="text-blue-600 dark:text-blue-400" size={36} />
            {stateModule.code} Property Investment Cash Flow Calculator
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {etfInvestingActive && etfAllocationPct > 0
              ? `How much is left after EVERYTHING? ${100 - etfAllocationPct}% goes to your offset automatically, the rest to ETF investing.`
              : 'How much is left after EVERYTHING? That goes to offset automatically.'}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {/* TODO-135: presentation only - this switches which view renders,
              never what the simulation computes (every figure is derived above
              `return`). Advanced is the default and is today's full interface. */}
          <button
            type="button"
            onClick={toggleUiMode}
            aria-pressed={isSimpleMode}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {isSimpleMode ? '⚙️ Advanced mode' : '✨ Simple mode'}
          </button>
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-3 mb-4">
        <p className="text-xs text-amber-800 dark:text-amber-400">
          ⚠️ Personal project for illustrative purposes only — not financial advice. Always consult a licensed
          financial adviser before making property decisions.
        </p>
      </div>

      <div className="mb-4">
        <ImpactColorLegend />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {!hasSavedScenario
            ? "Your inputs aren't saved yet — they reset if you reload the page."
            : lastSavedAt
              // A scenario saved before TODO-22 shipped won't have a savedAt yet.
              ? `💾 Saved ${new Date(lastSavedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
              : '💾 This scenario is saved in your browser.'}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveScenario}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            💾 Save
          </button>
          {hasSavedScenario && (
            <button
              type="button"
              onClick={handleClearSavedScenario}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              <RotateCcw size={14} />
              Reset to defaults
            </button>
          )}
        </div>
      </div>

      {/* TODO-135: the Simple/Advanced gate. Presentation only - every figure
          passed to SimpleModeView is computed above `return`, so switching
          modes cannot change a single number. Advanced renders today's tree
          untouched, which is also why the existing App-level tests need no
          edits. Gating the MOUNT (not just visibility) follows the same
          precedent as the lazy chart Suspense boundary below: Simple mode
          shouldn't mount the Timeline Explorer or pull in the recharts chunks
          at all. */}
      {isSimpleMode ? (
        <SimpleModeView
          propertyPrice={propertyPrice} onPropertyPriceChange={handlePropertyPriceChange}
          downPayment={downPayment} onDownPaymentChange={handleDownPaymentChange}
          loanAmount={loanAmount} onLoanAmountChange={handleLoanAmountChange}
          totalSavings={totalSavings} onTotalSavingsChange={setTotalSavings}
          interestRateField={interestRateField}
          loanTermYears={loanTermYears} onLoanTermYearsChange={setLoanTermYears}
          lvr={lvr}
          affordability={affordability}
          monthlyPayment={monthlyPayment}
          totalCashRequired={totalCashRequired}
          cashRemaining={cashRemaining}
          monthlyNetBalance={monthlyNetBalance}
          monthlyIncome={monthlyIncome}
          monthlyRentalIncome={monthlyRentalIncome}
          totalPropertyCost={totalPropertyCost}
          monthlyPersonalExpenses={monthlyPersonalExpenses}
          housingCostRatio={housingCostRatio} housingCostRatioClass={housingCostRatioClass}
          stressTestSurvivedDelta={stressTestSurvivedDelta} stressTestClass={stressTestClass}
          emergencyBufferMonths={emergencyBufferMonths} emergencyBufferClass={emergencyBufferClass} liquidSavings={liquidSavings}
          incomeSourceCount={incomeSources.length}
          personalExpenseCount={personalExpenseItems.length}
          offsetContributionCount={offsetContributions.length}
          activeAdvancedFeatures={activeAdvancedFeatures}
          onSwitchToAdvanced={toggleUiMode}
        />
      ) : (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT PANEL - Configuration */}
        <div className="lg:col-span-2 space-y-4">

          {/* Purchase Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Home size={24} className="text-blue-600 dark:text-blue-400" />
              Purchase Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Property Type</label>
                <select
                  value={propertyType}
                  onChange={(e) => handlePropertyTypeChange(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="house">House</option>
                  <option value="unit">Unit / Apartment</option>
                </select>
                {propertyType === 'house' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No strata - houses aren't on a shared title.</p>
                )}
              </div>

              <div>
                <label className={`flex items-center gap-2 text-sm font-medium ${isInvestmentProperty ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
                  <input
                    type="checkbox"
                    checked={isFirstHomeBuyer}
                    disabled={isInvestmentProperty}
                    onChange={(e) => handleFirstHomeBuyerChange(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500 disabled:cursor-not-allowed"
                  />
                  First Home Buyer ({stateModule.code} stamp duty concession)
                </label>
                {/* Outside the <label> deliberately - nesting it inside would
                    pull the tooltip button's own aria-label into the
                    checkbox's computed accessible name. */}
                <InfoTooltip label="What scheme is this?">
                  <p>{stateModule.label}'s <strong>{stateModule.fhbSchemeName}</strong> - full exemption up to $800k, tapering off by $1M.</p>
                </InfoTooltip>
                {isInvestmentProperty && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Not available for an investment property - the FHB concession requires occupying it.</p>
                )}
              </div>

              <div>
                <label className={`flex items-center gap-2 text-sm font-medium ${isFirstHomeBuyer ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
                  <input
                    type="checkbox"
                    checked={isInvestmentProperty}
                    disabled={isFirstHomeBuyer}
                    onChange={(e) => handleInvestmentPropertyChange(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500 disabled:cursor-not-allowed"
                  />
                  Investment Property
                </label>
                {isInvestmentProperty && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Adds Land Tax and Property Management to Property Expenses.</p>
                )}
                {isFirstHomeBuyer && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Not available for a first home buyer - occupying the property and investing in it are mutually exclusive.</p>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={isForeignPurchaser}
                    onChange={(e) => setIsForeignPurchaser(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                  />
                  Foreign Purchaser
                </label>
                {isForeignPurchaser && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Adds the {stateModule.code} {Math.round(stateModule.foreignPurchaserSurchargeRate * 100)}% Surcharge Purchaser Duty on top of Stamp Duty.</p>
                )}
              </div>

              {/* TODO-135: the static props of these six core fields live in
                  coreFieldConfigs.js because Simple mode re-renders the same
                  six - only value/onChange/children differ per mode. */}
              <NumberSliderField
                {...PROPERTY_PRICE_FIELD}
                value={propertyPrice}
                onChange={handlePropertyPriceChange}
              />

              {/* TODO-139: raising the deposit also reduces the headline Cash
                  Remaining figure (subtracted in calculateTotalCashRequired),
                  even as it improves every ongoing-loan metric - kept
                  positive/negative (mirrored below) because "more equity,
                  faster payoff" is the loan-side effect this scheme tracks. */}
              <NumberSliderField
                {...depositContributionField(propertyPrice)}
                value={downPayment}
                onChange={handleDownPaymentChange}
              >
                Loan: ${loanAmount.toLocaleString()} ({lvr.toFixed(1)}% LVR)
                <LvrBadge lvr={lvr} />
              </NumberSliderField>

              <NumberSliderField
                {...loanAmountField(propertyPrice)}
                value={loanAmount}
                onChange={handleLoanAmountChange}
              >
                Deposit: ${downPayment.toLocaleString()} ({(100 - lvr).toFixed(1)}% of price)
              </NumberSliderField>
            </div>
          </div>

          {/* Projection Assumptions - TODO-109: consolidates every growth/
              inflation/tax factor into one place, since none of them "belong"
              to any single existing card (Property Growth Rate used to live in
              Purchase Details above; Salary/Rent Growth, Vacancy, and
              Effective Tax Rate used to live in Income, below).
              TODO-141: these are always active. The collapse toggle below is
              purely presentational - it hides the editors, never the effect. */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Sprout size={24} className="text-green-600 dark:text-green-400" />
              Projection Assumptions
            </h2>

            <button
              type="button"
              onClick={() => setShowProjectionAssumptions(!showProjectionAssumptions)}
              aria-expanded={showProjectionAssumptions}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              {showProjectionAssumptions ? '▾' : '▸'} Projection assumptions{projectionIsFlatBaseline ? ' (flat baseline - all set to 0)' : ''}
            </button>
            {/* Outside the button deliberately - nesting it would pull the
                tooltip button's own aria-label into the toggle's computed
                accessible name. */}
            <InfoTooltip label="What are projection assumptions?">
              <p>The assumptions this calculator projects with: Property Growth Rate, Salary/Rent Growth Rate, Vacancy, Expense Growth Rate, Inflation Rate, and Effective Tax Rate. They are always applied - collapsing this section only hides the sliders, it never changes the numbers.</p>
              <p className="mt-2">Set them all to 0 for a flat baseline (no tax, nothing growing). That's a deliberate comparison point, not a more accurate calculation - real costs grow, so a flat baseline reads optimistically.</p>
              <p className="mt-2">Doesn't affect Credit Card or Mortgage-Free Age (in Financial Position), or the ETF tools (in Extra Investments &amp; Strategies) - those already have their own individual checkboxes.</p>
            </InfoTooltip>

            {showProjectionAssumptions && (
            <div className="space-y-4 mt-4">
              <NumberSliderField
                label="Property Growth Rate"
                value={propertyGrowthRate}
                onChange={setPropertyGrowthRate}
                min={-10}
                max={15}
                sliderMin={-5}
                sliderMax={10}
                step={0.1}
                color="blue"
                suffix="% p.a."
              >
                Annual change in your property's value, compounding monthly - feeds the Timeline Explorer's Projected Equity figure below. Defaults to 5%, the conservative end of commonly-cited long-run AU housing growth. Set to 0% to keep the property value fixed at the purchase price; negative values model a downturn.
              </NumberSliderField>

              <NumberSliderField
                label="Salary Growth Rate"
                value={salaryGrowthRate}
                onChange={setSalaryGrowthRate}
                min={-5}
                max={15}
                sliderMin={0}
                sliderMax={8}
                step={0.1}
                impact="positive"
                suffix="% p.a."
              >
                Annual growth applied only to "Salary/Wages" income sources, compounding monthly - independent of inflation, savings, or property growth (real wage growth moves on its own, via promotions or job changes). Defaults to 3%. Set to 0% to keep salary income flat.
              </NumberSliderField>

              <NumberSliderField
                label="Rent Growth Rate"
                value={rentGrowthRate}
                onChange={setRentGrowthRate}
                min={-5}
                max={15}
                sliderMin={0}
                sliderMax={8}
                step={0.1}
                impact="positive"
                suffix="% p.a."
              >
                Annual growth applied only to "House Rent"/"Room Rent" income sources, compounding monthly - independent of Salary Growth Rate above, since rent and wages move on their own schedules. Defaults to 3%. Set to 0% to keep rental income flat.
              </NumberSliderField>

              {/* TODO-139: negative, not positive - this is a real bug fix.
                  Increasing vacancy REDUCES rental income (vacancyFactor
                  multiplies it down in offsetSimulation.js), so it was
                  wrongly colored green before this change. */}
              <NumberSliderField
                label="Vacancy (weeks/year)"
                value={vacancyWeeksPerYear}
                onChange={setVacancyWeeksPerYear}
                min={0}
                max={52}
                sliderMin={0}
                sliderMax={12}
                step={1}
                impact="negative"
                suffix=" weeks"
              >
                Applies a flat, deterministic average reduction to "House Rent"/"Room Rent" income every month (e.g. 2 weeks/year ≈ 3.8% less) - not a random event, just an expected average. Defaults to 2 weeks. Set to 0 to assume the property is never vacant.
              </NumberSliderField>

              <NumberSliderField
                label="Expense Growth Rate"
                value={expenseGrowthRate}
                onChange={setExpenseGrowthRate}
                min={-5}
                max={15}
                sliderMin={0}
                sliderMax={8}
                step={0.1}
                impact="negative"
                suffix="% p.a."
              >
                Annual growth applied to your Personal and Property Expenses together, compounding inside the simulation - unlike the Inflation Rate below (which only affects the "today's dollars" display), this genuinely changes projected payoff time and total interest. Defaults to 2.5%. Set to 0% to keep expenses flat.
              </NumberSliderField>

              <NumberSliderField
                label="Inflation Rate"
                value={inflationRate}
                onChange={setInflationRate}
                min={0}
                max={15}
                sliderMin={0}
                sliderMax={8}
                step={0.1}
                color="blue"
                suffix="% p.a."
              >
                Shows "Total interest paid" in today's dollars alongside the nominal figure below - a display-only conversion, it doesn't change the loan simulation itself. Defaults to 2.5%. Set to 0% to show the nominal figure only.
              </NumberSliderField>

              {/* TODO-122: the slider and its ATO-bracket suggestion are wrapped
                  together so the pair is one child of this space-y-4 column.
                  The hint deliberately does NOT go through NumberSliderField's
                  `children`, which renders inside a single <p> - a nested <p>
                  would be invalid markup. */}
              <div>
                {/* TODO-139: negative, not purple - a reclassification, not
                    just a bug fix. Raising this unambiguously reduces net
                    income wherever any income source is Gross-marked, and
                    that reaches the headline total-interest/payoff-time
                    outcomes via getActiveAmount inside offsetSimulation.js. */}
                <NumberSliderField
                  label="Effective Tax Rate"
                  value={effectiveTaxRate}
                  onChange={setEffectiveTaxRate}
                  min={0}
                  max={90}
                  sliderMin={0}
                  sliderMax={47}
                  step={1}
                  impact="negative"
                  suffix="%"
                >
                  Only affects income sources checked "Gross (pre-tax)" below - converts them to net using this rate. Defaults to 20%. If you enter every income figure as net (take-home), set this to 0% and it becomes a no-op. Simplification: applied smoothly every month (PAYG-style), not as an annual tax return - typically well under 5% off for salary-only income, more with substantial Gross rental/investment income on top.
                </NumberSliderField>

                <div className="mt-2 p-2 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-100 dark:border-purple-800 text-xs">
                  {taxSuggestion === null ? (
                    <p className="text-gray-600 dark:text-gray-300">
                      🧾 No income source is marked "Gross (pre-tax)", so there's nothing to base a suggested rate on - a net figure's pre-tax amount can't be worked out without already knowing the rate. Tick that box on an income source to see what ATO brackets would suggest.
                    </p>
                  ) : (
                    <>
                      <p className="text-gray-700 dark:text-gray-200">
                        🧾 ATO brackets + the 2% Medicare levy suggest{' '}
                        <span className="font-semibold text-purple-700 dark:text-purple-400">~{suggestedTaxRate}%</span>
                        {' '}on your ${Math.round(taxSuggestion.annualGrossIncome).toLocaleString()}/year of Gross-marked income.
                      </p>
                      {suggestedTaxRate === effectiveTaxRate ? (
                        <p className="text-gray-500 dark:text-gray-400 mt-1">That matches your current rate.</p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEffectiveTaxRate(suggestedTaxRate)}
                          className="mt-2 px-2 py-1 rounded bg-purple-600 text-white font-medium hover:bg-purple-700"
                        >
                          Use this rate
                        </button>
                      )}
                    </>
                  )}
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Illustrative, from published rates and the income you entered - not tax advice. It's an average rate across all your income - not the marginal rate on your top dollar, which matters most for rental income (see below if you have any), less so for ordinary salary. It also ignores deductions, offsets and negative gearing, so it reads high if you have much to claim.
                  </p>
                </div>

                {marginalRentalRate !== null && (
                  <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-800 text-xs">
                    <p className="text-gray-700 dark:text-gray-200">
                      🏠 Your ${Math.round(marginalRentalRate.rentalGrossAnnual).toLocaleString()}/year of Gross-marked rental income sits on top of your other income, landing in the {Math.round(marginalRentalRate.marginalRatePct)}% bracket (including the Medicare levy) - not the {suggestedTaxRate}% average above.
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      Informational only - there's no single slider that can apply a different rate to just your rental income, so this isn't something to "use" here.
                    </p>
                  </div>
                )}
              </div>
            </div>
            )}
          </div>

          {/* Financial Position */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Wallet size={24} className="text-blue-600 dark:text-blue-400" />
              Financial Position
            </h2>

            <div className="space-y-4">
              <NumberSliderField
                {...AVAILABLE_SAVINGS_FIELD}
                value={totalSavings}
                onChange={setTotalSavings}
              >
                The whole savings pool the deposit and upfront costs come out of.
              </NumberSliderField>

              <button
                type="button"
                onClick={() => setShowFinancialPositionAdvanced(!showFinancialPositionAdvanced)}
                aria-expanded={financialPositionAdvancedExpanded}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                {financialPositionAdvancedExpanded ? '▾' : '▸'} ⚙️ Advanced Assumptions
              </button>

              {financialPositionAdvancedExpanded && (
              <div className="space-y-4 pl-3 border-l-2 border-gray-200 dark:border-gray-700">
              <NumberSliderField
                label="Savings Interest Rate"
                value={savingsInterestRate}
                onChange={setSavingsInterestRate}
                min={0}
                max={15}
                sliderMin={0}
                sliderMax={8}
                step={0.1}
                color="green"
                suffix="% p.a."
              >
                Annual interest earned on your Remaining Savings - the cash left over after settlement. Your monthly surplus doesn't come here; it goes to the offset (and to ETF investing, if you enable it). 0% (default) means no interest is modeled.
              </NumberSliderField>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={useCreditCard}
                    onChange={(e) => setUseCreditCard(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                  />
                  Model credit card usage
                </label>
                {/* Outside the <label> deliberately - nesting it inside would
                    pull the tooltip button's own aria-label into the
                    checkbox's computed accessible name. */}
                <InfoTooltip label="How does the credit card benefit work?">
                  <p>Paying eligible expenses by credit card instead of debit, and clearing the balance in full every month, lets that money sit in your offset a little longer before it's swept out to pay the statement - plus you may earn cashback or rewards.</p>
                  <p className="mt-2">Assumes you never carry a balance or pay interest/late fees. Keep any expense where your bank charges a fee for <em>not</em> using debit off this - that fee can erase the whole benefit.</p>
                </InfoTooltip>
                {!useCreditCard && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Estimates the small extra benefit of paying eligible expenses by credit card and clearing the balance in full every month.</p>
                )}
              </div>

              {useCreditCard && (
                <>
                  <NumberSliderField
                    label="Monthly Card Spend"
                    value={monthlyCardSpend}
                    onChange={setMonthlyCardSpend}
                    min={0}
                    max={10000}
                    sliderMin={0}
                    sliderMax={5000}
                    step={50}
                    impact="positive"
                    prefix="$"
                  >
                    Eligible expenses (paid off in full every month) that you'd move from debit to credit card.
                  </NumberSliderField>

                  <NumberSliderField
                    label="Average Days Payment Delayed"
                    value={avgExtraDaysHeld}
                    onChange={setAvgExtraDaysHeld}
                    min={0}
                    max={60}
                    sliderMin={0}
                    sliderMax={45}
                    step={1}
                    impact="positive"
                    suffix=" days"
                  >
                    How much longer, on average, this money sits in your offset compared to paying by debit immediately - well under your card's advertised "interest-free days" (e.g. 55), since you spend throughout the month, not all on day one. 27 is a reasonable default.
                  </NumberSliderField>

                  <NumberSliderField
                    label="Cashback / Rewards Rate"
                    value={cashbackPct}
                    onChange={setCashbackPct}
                    min={0}
                    max={5}
                    sliderMin={0}
                    sliderMax={2}
                    step={0.1}
                    impact="positive"
                    suffix="%"
                  />

                  <NumberSliderField
                    label="Annual Card Fee"
                    value={annualCardFee}
                    onChange={setAnnualCardFee}
                    min={0}
                    max={1000}
                    sliderMin={0}
                    sliderMax={500}
                    step={5}
                    impact="negative"
                    prefix="$"
                  />

                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm">
                    <p className="text-gray-700 dark:text-gray-200">
                      💳 Estimated annual benefit: <span className="font-bold">{creditCardNetBenefit >= 0 ? '+' : '-'}${Math.abs(Math.round(creditCardNetBenefit)).toLocaleString()}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Offset timing: ~${Math.round(offsetTimingBenefit).toLocaleString()} · Cashback: ~${Math.round(monthlyCardSpend * 12 * cashbackPct / 100).toLocaleString()} · Fee: -${Math.round(annualCardFee).toLocaleString()}
                    </p>
                  </div>
                </>
              )}

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={showMortgageFreeAge}
                    onChange={(e) => setShowMortgageFreeAge(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                  />
                  Show my Mortgage-Free Age
                </label>
                {!showMortgageFreeAge && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enter your current age to see the age you'll be mortgage-free in the Purchase Health Check below.</p>
                )}
              </div>

              {showMortgageFreeAge && (
                <NumberSliderField
                  label="Your Current Age"
                  value={currentAge}
                  onChange={setCurrentAge}
                  min={18}
                  max={100}
                  sliderMin={18}
                  sliderMax={80}
                  step={1}
                  color="indigo"
                  suffix=" years"
                >
                  Used to show your Mortgage-Free Age in the Purchase Health Check below.
                </NumberSliderField>
              )}
              </div>
              )}

              <SteppedExpenseField {...INTEREST_RATE_FIELD} field={interestRateField} />

              {/* TODO-139: neutral, not negative - verified numerically
                  against the actual offset loop (not the textbook
                  amortization formula) that a longer term does not
                  monotonically raise total interest once there's monthly
                  surplus: freeing up cash by extending the term just routes
                  more of it into the offset instead, nearly interchangeable
                  with a shorter term's faster paydown. Direction flips with
                  the rest of the user's inputs. */}
              <NumberSliderField
                {...LOAN_TERM_FIELD}
                value={loanTermYears}
                onChange={setLoanTermYears}
              />

              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Repayments: ${Math.round(monthlyPayment).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Extra Investments & Strategies - TODO-137. Everything ETF
              lives here instead of inside Financial Position's Advanced
              Assumptions, which had grown into an unrelated grab-bag
              (savings rate, credit card, mortgage-free age, ETF).
              Two controls on purpose, and they are NOT the same thing:
              the checkbox is an opt-in that genuinely pauses the ETF
              effect on the simulation, while the collapse below is
              presentation only (TODO-141's rule - hiding an editor must
              never change the model). */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <TrendingUp size={24} className="text-indigo-600 dark:text-indigo-400" />
              Extra Investments &amp; Strategies
            </h2>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={showEtfInvestingOptions}
                    onChange={(e) => setShowEtfInvestingOptions(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                  />
                  Show ETF investing options
                </label>
                {!showEtfInvestingOptions && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ETF controls, comparisons, and projections are hidden and paused until you turn this on.</p>
                )}
              </div>

            {showEtfInvestingOptions && (
            <>
              <button
                type="button"
                onClick={() => setShowExtraInvestments(!showExtraInvestments)}
                aria-expanded={showExtraInvestments}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                {showExtraInvestments ? '▾' : '▸'} ETF settings and strategy comparison
              </button>
              {/* Outside the button deliberately - nesting it would pull the
                  tooltip button's own aria-label into the toggle's computed
                  accessible name. */}
              <InfoTooltip label="What lives in this section?">
                <p>Optional tools for modelling money you send to ETFs instead of your offset: how much to divert, when to start, and how the alternatives compare over time.</p>
                <p className="mt-2">Collapsing this only hides the controls - whatever you have configured keeps applying. Untick the checkbox above to actually pause it.</p>
              </InfoTooltip>

              {showExtraInvestments && (
              <div className="space-y-4 mt-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={showOpportunityCost}
                    onChange={(e) => setShowOpportunityCost(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                  />
                  Compare Offset vs ETF Investing
                </label>
                {/* Outside the <label> deliberately - nesting it inside would
                    pull the tooltip button's own aria-label into the
                    checkbox's computed accessible name. */}
                <InfoTooltip label="What is this comparing?">
                  <p>Your offset's "return" is exactly your mortgage rate - guaranteed and tax-free, since it's not income, the bank just stops charging you interest on that portion of the loan. Matching that with an ETF needs an even higher return before tax, since capital gains/dividends are taxable and returns aren't guaranteed.</p>
                  <p className="mt-2">This calculator applies Australia's 50% capital gains discount (assuming a &gt;12 month holding) before taxing ETF growth at your Effective Tax Rate - still less favorable than the offset's fully tax-free return, but not taxed at the full rate either.</p>
                  <p className="mt-2">This is a simple side-by-side, not a recommendation - always consult a licensed financial adviser before making investment decisions.</p>
                </InfoTooltip>
                {!showOpportunityCost && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Shows what your next dollar earns in the offset vs. an ETF, side by side.</p>
                )}
              </div>

              <div>
                <label className={`flex items-center gap-2 text-sm font-medium ${effectiveTaxRate === 0 ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
                  <input
                    type="checkbox"
                    checked={useEtfInvesting}
                    disabled={effectiveTaxRate === 0}
                    onChange={(e) => setUseEtfInvesting(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500 disabled:cursor-not-allowed"
                  />
                  Invest in ETFs
                </label>
                {/* Outside the <label> deliberately - nesting it inside would
                    pull the tooltip button's own aria-label into the
                    checkbox's computed accessible name. */}
                <InfoTooltip label="What does this do?">
                  <p>Diverts part of what would otherwise go to your offset into a growing ETF balance instead - a single, manually-set strategy, simulated deterministically like everything else in this app. Slower offset payoff, potentially higher return.</p>
                  <p className="mt-2">This is illustrative only, not a recommendation - always consult a licensed financial adviser before making investment decisions.</p>
                </InfoTooltip>
                {effectiveTaxRate === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Set an Effective Tax Rate in the Projection Assumptions card above first - otherwise this compares a pre-tax ETF return against the offset's tax-free return, which isn't a fair comparison.</p>
                ) : !useEtfInvesting && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Diverts part of your offset contribution into a growing ETF balance instead.</p>
                )}
              </div>

              {(showOpportunityCost || useEtfInvesting) && (
                <NumberSliderField
                  label="Expected ETF Return"
                  value={expectedEtfReturn}
                  onChange={setExpectedEtfReturn}
                  min={0}
                  max={20}
                  sliderMin={0}
                  sliderMax={12}
                  step={0.1}
                  color="blue"
                  suffix="% p.a."
                >
                  A diversified ETF has historically returned roughly this much per year over the long term - but unlike the offset, it's not guaranteed and can fall in any given year. This should be TOTAL return (price growth plus dividends/distributions reinvested), not just price growth alone.
                </NumberSliderField>
              )}

              {showOpportunityCost && (
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm space-y-3">
                  <p className="font-semibold text-gray-700 dark:text-gray-200">One extra dollar goes to...</p>
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="text-gray-700 dark:text-gray-200 font-medium">🏦 Offset</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Guaranteed, tax-free, no market risk</p>
                    </div>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400 whitespace-nowrap">{interestRate.toFixed(2)}%</p>
                  </div>
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="text-gray-700 dark:text-gray-200 font-medium">📈 ETF</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Expected, taxable, market risk - not guaranteed</p>
                    </div>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{expectedEtfReturn.toFixed(2)}%</p>
                  </div>
                </div>
              )}

              {etfInvestingActive && (
                <NumberSliderField
                  label="ETF Allocation"
                  value={etfAllocationPct}
                  onChange={setEtfAllocationPct}
                  min={0}
                  max={100}
                  sliderMin={0}
                  sliderMax={100}
                  step={5}
                  impact="neutral"
                  splitColor="etf"
                  suffix="%"
                >
                  % of each month's surplus that goes to ETF investing instead of your offset - the remainder goes to the offset. 0% sends the whole surplus to the offset. A deficit month invests nothing.
                </NumberSliderField>
              )}

              {/* TODO-144: one "when to start" selector instead of three
                  overlapping gates. The engine ANDs all three criteria with
                  no-op defaults, and only the selected one is passed a
                  non-default value - so the user reasons about one condition,
                  not the intersection of three. */}
              {etfInvestingActive && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Start ETF investing when</p>

                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <input
                      type="radio"
                      name="etfStartTrigger"
                      checked={etfStartTrigger === 'immediate'}
                      onChange={() => setEtfStartTrigger('immediate')}
                      className="h-4 w-4 border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
                    />
                    Right away
                  </label>

                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <input
                      type="radio"
                      name="etfStartTrigger"
                      checked={etfStartTrigger === 'month'}
                      onChange={() => setEtfStartTrigger('month')}
                      className="h-4 w-4 border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
                    />
                    After a set number of months
                  </label>
                  {etfStartTrigger === 'month' && (
                    <div className="pl-6">
                      <NumberSliderField
                        label="Start from month"
                        value={etfStartMonth}
                        onChange={setEtfStartMonth}
                        min={1}
                        max={totalMonths}
                        sliderMin={1}
                        sliderMax={120}
                        step={1}
                        impact="neutral"
                      >
                        Everything goes to the offset until this month, then ETF Allocation (above) applies. A fixed calendar delay - unlike the loan-% option below, it means the same wait regardless of how the loan performs.
                      </NumberSliderField>
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <input
                      type="radio"
                      name="etfStartTrigger"
                      checked={etfStartTrigger === 'loanRatio'}
                      onChange={() => setEtfStartTrigger('loanRatio')}
                      className="h-4 w-4 border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
                    />
                    The offset reaches a share of the loan
                  </label>
                  {etfStartTrigger === 'loanRatio' && (
                    <div className="pl-6">
                      <NumberSliderField
                        label="Switch Trigger"
                        value={switchThresholdPct}
                        onChange={setSwitchThresholdPct}
                        min={0}
                        max={100}
                        sliderMin={0}
                        sliderMax={100}
                        step={5}
                        impact="neutral"
                        suffix="%"
                      >
                        Once your offset balance reaches this % of your remaining loan balance, ETF Allocation (above) applies. Re-checked every month, so a deficit month that drains the offset back below the threshold pauses investing until it recovers.
                      </NumberSliderField>
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <input
                      type="radio"
                      name="etfStartTrigger"
                      checked={etfStartTrigger === 'reserve'}
                      onChange={() => setEtfStartTrigger('reserve')}
                      className="h-4 w-4 border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
                    />
                    The offset covers a few months of expenses
                  </label>
                  {etfStartTrigger === 'reserve' && (
                    <div className="pl-6">
                      <NumberSliderField
                        label="Reserve first"
                        value={etfReserveMonths}
                        onChange={setEtfReserveMonths}
                        min={0}
                        max={60}
                        sliderMin={0}
                        sliderMax={24}
                        step={1}
                        impact="neutral"
                        suffix=" months"
                      >
                        Bank this many months of outgoings in the offset before investing anything. A month means the same thing here as in the Emergency Buffer indicator: loan repayment + property expenses + personal expenses. Re-checked every month, so if the offset drops back below the reserve, investing pauses until it recovers.
                      </NumberSliderField>
                    </div>
                  )}
                </div>
              )}

              {etfInvestingActive && (() => {
                // TODO-98: no useMemo - 441 sims x a few hundred iterations
                // each is trivial for JS (sub-100ms), and this file has no
                // existing memoization pattern to extend. Revisit only if
                // profiling ever shows real jank.
                const gridBaseParams = {
                  contributions: offsetContributions,
                  personalExpenseItems,
                  incomeSources,
                  expenseFields,
                  monthlyToOffset: baseMonthlySurplus,
                  loanAmount,
                  monthlyRate,
                  monthlyPayment,
                  interestRateField,
                  initialSavingsBalance: cashRemaining,
                  savingsInterestRate,
                  propertyPrice,
                  propertyGrowthRate: propertyGrowthRate,
                  salaryGrowthRate: salaryGrowthRate,
                  rentGrowthRate: rentGrowthRate,
                  vacancyWeeksPerYear: vacancyWeeksPerYear,
                  expenseGrowthRate: expenseGrowthRate,
                  effectiveTaxRate: effectiveTaxRate,
                  isInvestmentProperty,
                  expectedEtfReturn,
                  // TODO-144 fix: stated explicitly rather than left to the
                  // engine's defaults, so this reads as a decision and not as
                  // the same oversight that was just fixed in the two bundles
                  // below. This grid SEARCHES the loan-% axis, so it explores
                  // that criterion in isolation - layering the user's own
                  // month/reserve gate on top would make every row a
                  // combination the selector says cannot exist. The caption
                  // below says so, and Apply switches the user to loan-% mode.
                  etfStartMonth: 1,
                  etfReserveMonths: 0,
                  maxMonths: totalMonths,
                };
                const gridResults = runStrategyGrid(gridBaseParams);
                const paretoFront = selectParetoFront(gridResults);
                const baselineRow = gridResults.find((r) => r.etfAllocationPct === 0);
                const baselineInterest = baselineRow ? baselineRow.totalInterestPaid : 0;

                return (
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm space-y-3">
                    <p className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      🔍 Strategy Comparison
                      <InfoTooltip label="What is this searching?">
                        <p>Searches 441 combinations of when to start investing (Switch Trigger) and how much to divert (ETF Allocation) once switched on, in 5% steps - holding everything else the same. Shows the non-dominated (Pareto-optimal) strategies below: for each, no other strategy has both a lower total interest paid AND a higher ETF balance.</p>
                        <p className="mt-2">There's no single "best" - which one to pick depends on how you personally weigh certainty (offset) against expected but risky growth (ETF). "Apply" sets the sliders above to that row's values.</p>
                        <p className="mt-2">A row flagged with a cash shortfall only reached these numbers by running out of money in some months - its interest/ETF figures assume income it didn't actually have, not a free win over the others.</p>
                      </InfoTooltip>
                    </p>
                    {/* TODO-144 fix: this grid searches the loan-% axis, so it
                        explores that criterion on its own. Saying so keeps it
                        honest when the user has picked a different criterion -
                        and makes Apply's own criterion switch predictable
                        rather than a surprise. */}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Explores the "% of the loan" criterion for when to start investing.
                      {etfStartTrigger !== 'loanRatio' && ' You currently start on a different criterion, so applying a row will switch you to that criterion.'}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="text-gray-500 dark:text-gray-400">
                            <th className="pr-2 pb-1 font-medium whitespace-nowrap">Switch</th>
                            <th className="pr-2 pb-1 font-medium whitespace-nowrap">Allocation</th>
                            <th className="pr-2 pb-1 font-medium whitespace-nowrap">Interest Paid</th>
                            <th className="pr-2 pb-1 font-medium whitespace-nowrap">
                              <span className="flex items-center gap-1">
                                ETF Balance
                                <InfoTooltip label="Why isn't this perfectly fair?">
                                  <p>Measured at whichever month THIS strategy's own simulation stops (loan payoff, or the end of your loan term). Strategies that pay off faster aren't credited for investing the freed-up repayment afterward, so this slightly understates low-risk strategies' true long-run wealth.</p>
                                  <p className="mt-2">Total Interest Paid isn't affected by this and is always a fair comparison.</p>
                                </InfoTooltip>
                              </span>
                            </th>
                            <th className="pr-2 pb-1 font-medium whitespace-nowrap">Risk</th>
                            <th className="pr-2 pb-1 font-medium whitespace-nowrap">Crash Test</th>
                            <th className="pr-2 pb-1 font-medium whitespace-nowrap">Cash Shortfall</th>
                            <th className="pb-1 font-medium" />
                          </tr>
                        </thead>
                        <tbody>
                          {paretoFront.map((row) => {
                            const isApplied = row.switchThresholdPct === switchThresholdPct && row.etfAllocationPct === etfAllocationPct;
                            const crashSurvived = calculateEtfCrashSurvivedPct(row.etfBalance, row.totalInterestPaid - baselineInterest);
                            const crashClass = classifyEtfCrash(crashSurvived);
                            return (
                              <tr key={`${row.switchThresholdPct}-${row.etfAllocationPct}`} className={isApplied ? 'bg-gray-100 dark:bg-gray-800' : undefined}>
                                <td className="pr-2 py-1 whitespace-nowrap text-gray-700 dark:text-gray-200">{row.switchThresholdPct}%</td>
                                <td className="pr-2 py-1 whitespace-nowrap text-gray-700 dark:text-gray-200">{row.etfAllocationPct}%</td>
                                <td className="pr-2 py-1 whitespace-nowrap text-gray-700 dark:text-gray-200">${row.totalInterestPaid.toLocaleString()}</td>
                                <td className="pr-2 py-1 whitespace-nowrap text-gray-700 dark:text-gray-200">${row.etfBalance.toLocaleString()}</td>
                                <td className="pr-2 py-1 whitespace-nowrap text-gray-700 dark:text-gray-200">{row.riskScore}</td>
                                <td className={`pr-2 py-1 whitespace-nowrap font-medium ${crashClass.textClass}`}>{crashClass.symbol} {crashSurvived}%</td>
                                <td
                                  className={row.totalCashShortfall > 0
                                    ? 'pr-2 py-1 whitespace-nowrap font-medium text-red-600 dark:text-red-400'
                                    : 'pr-2 py-1 whitespace-nowrap text-gray-700 dark:text-gray-200'}
                                >
                                  {row.totalCashShortfall > 0
                                    ? `⚠️ $${row.totalCashShortfall.toLocaleString()} over ${row.monthsWithShortfall} mo`
                                    : 'None'}
                                </td>
                                <td className="py-1 whitespace-nowrap">
                                  <button
                                    // TODO-144: this grid varies the LOAN-RATIO
                                    // threshold, so applying a row must also
                                    // select that criterion - otherwise the
                                    // applied value wouldn't reach the engine
                                    // (only the selected criterion is passed a
                                    // non-default value) and Apply would
                                    // silently do nothing.
                                    onClick={() => { setEtfStartTrigger('loanRatio'); setSwitchThresholdPct(row.switchThresholdPct); setEtfAllocationPct(row.etfAllocationPct); }}
                                    disabled={isApplied}
                                    className="text-xs px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700"
                                  >
                                    {isApplied ? 'Applied' : 'Apply'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* TODO-137: the narrower companion to the Pareto search above.
                  That one grid-searches 441 (trigger, allocation) pairs; this
                  one takes the allocation you actually chose and shows where
                  it sits between the two extremes, year by year. Same IIFE
                  pattern so the three simulations only run while the section
                  is open and ETF investing is on. */}
              {etfInvestingActive && (() => {
                const scenarioBaseParams = {
                  contributions: offsetContributions,
                  personalExpenseItems,
                  incomeSources,
                  expenseFields,
                  monthlyToOffset: baseMonthlySurplus,
                  loanAmount,
                  monthlyRate,
                  monthlyPayment,
                  interestRateField,
                  initialSavingsBalance: cashRemaining,
                  savingsInterestRate,
                  propertyPrice,
                  propertyGrowthRate,
                  salaryGrowthRate,
                  rentGrowthRate,
                  vacancyWeeksPerYear,
                  expenseGrowthRate,
                  effectiveTaxRate,
                  isInvestmentProperty,
                  expectedEtfReturn,
                  // TODO-144 fix: the EFFECTIVE values, same as the headline
                  // projection. Passing the raw switchThresholdPct here let a
                  // threshold the user had switched away from keep gating this
                  // panel, and omitting the two gates made it simulate investing
                  // from month 1 regardless of the delay they asked for.
                  switchThresholdPct: effectiveSwitchThresholdPct,
                  etfStartMonth: effectiveEtfStartMonth,
                  etfReserveMonths: effectiveEtfReserveMonths,
                  maxMonths: totalMonths,
                };
                const runs = runStrategyScenarios(scenarioBaseParams, etfAllocationPct);
                // A run that hit the sentinel early-out has no monthlyData at
                // all - same guard the Timeline Explorer uses.
                if (!hasUsableData(runs)) return null;

                const snapshotContext = {
                  loanAmount,
                  monthZeroInterest,
                  initialSavingsBalance: cashRemaining,
                  initialPropertyValue: propertyPrice,
                };
                const summaries = runs.map((run) => summariseStrategy(run, snapshotContext));
                const rows = buildComparisonRows(runs, comparisonMetric, snapshotContext);
                const monthlyStepping = getComparisonMonths(runs).length > 0
                  && Math.max(...runs.map(r => r.simulation.months)) <= YEARLY_STEP_MIN_MONTHS;

                return (
                  <StrategyScenarioComparison
                    summaries={summaries}
                    rows={rows}
                    metricKey={comparisonMetric}
                    onMetricChange={setComparisonMetric}
                    monthlyStepping={monthlyStepping}
                  />
                );
              })()}

              {/* TODO-138: the third and narrowest of the ETF comparisons.
                  The Pareto grid searches allocations; the panel above shows
                  where the chosen one sits between the extremes; this one
                  holds the allocation fixed and asks how much of the answer
                  depends on the return assumption - plus the return that
                  would merely match the offset. Same IIFE pattern so nothing
                  computes while the section is closed. */}
              {etfInvestingActive && etfAllocationPct > 0 && (() => {
                const sensitivityBaseParams = {
                  contributions: offsetContributions,
                  personalExpenseItems,
                  incomeSources,
                  expenseFields,
                  monthlyToOffset: baseMonthlySurplus,
                  loanAmount,
                  monthlyRate,
                  monthlyPayment,
                  interestRateField,
                  initialSavingsBalance: cashRemaining,
                  savingsInterestRate,
                  propertyPrice,
                  propertyGrowthRate,
                  salaryGrowthRate,
                  rentGrowthRate,
                  vacancyWeeksPerYear,
                  expenseGrowthRate,
                  effectiveTaxRate,
                  isInvestmentProperty,
                  expectedEtfReturn,
                  // TODO-144 fix: the EFFECTIVE values, same as the headline
                  // projection. Passing the raw switchThresholdPct here let a
                  // threshold the user had switched away from keep gating this
                  // panel, and omitting the two gates made it simulate investing
                  // from month 1 regardless of the delay they asked for.
                  switchThresholdPct: effectiveSwitchThresholdPct,
                  etfStartMonth: effectiveEtfStartMonth,
                  etfReserveMonths: effectiveEtfReserveMonths,
                  maxMonths: totalMonths,
                };
                const returnRuns = runReturnScenarios(sensitivityBaseParams, etfAllocationPct, expectedEtfReturn);
                if (!hasUsableData(returnRuns)) return null;

                const snapshotContext = {
                  loanAmount,
                  monthZeroInterest,
                  initialSavingsBalance: cashRemaining,
                  initialPropertyValue: propertyPrice,
                };
                // The offset-only arm is the reference every column is
                // measured against - reuse the existing scenario factory
                // rather than hand-rolling a fourth base-params bundle.
                const offsetOnlyRun = runStrategyScenarios(sensitivityBaseParams, 0)[0];
                if (!hasUsableData([offsetOnlyRun])) return null;

                return (
                  <EtfReturnSensitivity
                    summaries={returnRuns.map((run) => summariseStrategy(run, snapshotContext))}
                    offsetOnlySummary={summariseStrategy(offsetOnlyRun, snapshotContext)}
                    breakEven={findBreakEvenEtfReturn(sensitivityBaseParams, etfAllocationPct, snapshotContext)}
                    allocationPct={etfAllocationPct}
                  />
                );
              })()}

              {/* TODO-145: gated on a non-zero allocation as well as ETF being
                  active - at 0% the ETF balance is 0, so every column would read
                  identically and the panel would be pure noise. */}
              {etfInvestingActive && etfAllocationPct > 0 && (
                <div className="space-y-3">
                  <NumberSliderField
                    label="Crash month"
                    value={etfCrashMonth}
                    onChange={setEtfCrashMonth}
                    min={1}
                    max={totalMonths}
                    sliderMin={1}
                    sliderMax={Math.min(240, totalMonths)}
                    step={1}
                    impact="neutral"
                  >
                    Which month the stress test below drops your ETF balance in. A stress-test input, so it has no better or worse direction of its own - though a later crash generally costs more, since your balance is bigger by then. A crash after the loan is paid off has no effect, because the projection ends there.
                  </NumberSliderField>

                  {(() => {
                    const crashBaseParams = {
                      contributions: offsetContributions,
                      personalExpenseItems,
                      incomeSources,
                      expenseFields,
                      monthlyToOffset: baseMonthlySurplus,
                      loanAmount,
                      monthlyRate,
                      monthlyPayment,
                      interestRateField,
                      initialSavingsBalance: cashRemaining,
                      savingsInterestRate,
                      propertyPrice,
                      propertyGrowthRate,
                      salaryGrowthRate,
                      rentGrowthRate,
                      vacancyWeeksPerYear,
                      expenseGrowthRate,
                      effectiveTaxRate,
                      isInvestmentProperty,
                      expectedEtfReturn,
                      switchThresholdPct: effectiveSwitchThresholdPct,
                      etfStartMonth: effectiveEtfStartMonth,
                      etfReserveMonths: effectiveEtfReserveMonths,
                      maxMonths: totalMonths,
                    };
                    const crashRuns = runCrashScenarios(crashBaseParams, etfAllocationPct, etfCrashMonth);
                    if (!hasUsableData(crashRuns)) return null;

                    const snapshotContext = {
                      loanAmount,
                      monthZeroInterest,
                      initialSavingsBalance: cashRemaining,
                      initialPropertyValue: propertyPrice,
                    };
                    return (
                      <EtfCrashStressTest
                        summaries={crashRuns.map((run) => summariseStrategy(run, snapshotContext))}
                        crashMonth={etfCrashMonth}
                      />
                    );
                  })()}
                </div>
              )}

              {/* TODO-142: a static reference panel, not a fourth comparison -
                  it runs no simulation and reads only the Emergency Buffer
                  figure Purchase Health Check already computes. Same gate as
                  its two siblings above, so it only shows once ETF investing
                  is genuinely active. */}
              {etfInvestingActive && (
                <RiskToleranceProfiles
                  emergencyBufferMonths={emergencyBufferMonths}
                  emergencyBufferClassification={emergencyBufferClass}
                />
              )}
              </div>
              )}
            </>
            )}
            </div>
          </div>

          {/* Offset Contributions - TODO-115: split out of "Your Personal
              Expenses" into its own card. offsetContributions is a
              mortgage-offset feature (read by calculateLoanWithOffset and
              the "TO OFFSET" results card), not a personal expense - it
              never had a real reason to share that card's toggle. */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <PiggyBank size={24} className="text-cyan-600 dark:text-cyan-400" />
              Offset Contributions
            </h2>

            <button
              type="button"
              onClick={() => setShowOffsetContributions(!showOffsetContributions)}
              aria-expanded={showOffsetContributions}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              {showOffsetContributions ? '▾' : '▸'} Offset contributions breakdown (subtotal: ${totalScheduledOffset.toLocaleString()})
            </button>

            {showOffsetContributions && (
            <div className="space-y-4 mt-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-md font-bold text-gray-700 dark:text-gray-200">💰 Offset Contributions Schedule</h3>
                  <button
                    onClick={() => setShowAddContribution(!showAddContribution)}
                    aria-expanded={showAddContribution}
                    className="px-3 py-1 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600 transition-colors"
                  >
                    {showAddContribution ? '✕ Cancel' : '+ Add'}
                  </button>
                </div>

                {/* Add contribution form */}
                {showAddContribution && (
                  <div className="mb-3 p-3 bg-cyan-50 dark:bg-cyan-950 rounded-lg border border-cyan-200 dark:border-cyan-800 space-y-3">
                    <NumberSliderField
                      label="Amount ($)"
                      value={newContribAmount}
                      onChange={setNewContribAmount}
                      min={0}
                      max={500000}
                      impact="positive"
                      prefix="$"
                      hideSlider
                    />

                    <ScheduleFields form={contribSchedule} color="cyan" accentColor="blue" />

                    <button
                      onClick={addOffsetContribution}
                      className="w-full py-3 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 transition-colors"
                    >
                      Add Contribution
                    </button>
                  </div>
                )}

                {/* List of contributions */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {offsetContributions.map((contrib) => (
                    <div
                      key={contrib.id}
                      className="flex items-center justify-between p-3 bg-gradient-to-r from-cyan-50 dark:from-cyan-950 to-blue-50 dark:to-blue-950 rounded-lg border border-cyan-200 dark:border-cyan-800"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🔵</span>
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-100">
                              {formatScheduleLabel(contrib)}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-300">
                              {contrib.recurrence === 'none'
                                ? formatMonthsDetailed(contrib.startMonth).human
                                : `Starts in ${formatMonthsDetailed(contrib.startMonth).human}`}
                            </p>
                          </div>
                        </div>
                        <p className="text-lg font-bold text-cyan-700 dark:text-cyan-400 mt-1 ml-7">
                          ${contrib.amount.toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => removeOffsetContribution(contrib.id)}
                        className="ml-3 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Total scheduled */}
                <div className="mt-3 p-3 bg-gradient-to-r from-indigo-50 dark:from-indigo-950 to-purple-50 dark:to-purple-950 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    📊 One-Time Contributions Total: <span className="text-indigo-700 dark:text-indigo-400 text-lg">${totalScheduledOffset.toLocaleString()}</span>
                  </p>
                  {recurringContributionsCount > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Plus {recurringContributionsCount} recurring contribution{recurringContributionsCount !== 1 ? 's' : ''} - applied
                      automatically each month it's active, not counted in this total or in Cash Remaining below.
                    </p>
                  )}
                  {totalScheduledOffset > 0 && (
                    <div className="mt-1 space-y-1">
                      {/* "% of loan balance" reads as nonsense with no loan, so drop the line entirely. */}
                      {loanAmount > 0 && (
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                          Reduces {safePercentage(totalScheduledOffset, loanAmount).toFixed(1)}% of loan balance
                        </p>
                      )}
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400">
                        ~${Math.round(interestSaved).toLocaleString()} saved in interest
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Upfront Costs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <DollarSign size={24} className="text-purple-600 dark:text-purple-400" />
              Upfront Costs ({stateModule.code})
            </h2>

            <div className="space-y-4">
              {lvr > 80 && (
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={payLmiUpfront}
                    onChange={(e) => setPayLmiUpfront(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                  />
                  Pay LMI upfront in cash (instead of financing it into the loan)
                </label>
              )}

              <button
                type="button"
                onClick={() => setShowClosingCostsBreakdown(!showClosingCostsBreakdown)}
                aria-expanded={showClosingCostsBreakdown}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                {showClosingCostsBreakdown ? '▾' : '▸'} Closing costs breakdown (subtotal: ${closingCostsSubtotal.toLocaleString()})
              </button>

              {showClosingCostsBreakdown && (
                <div className="space-y-4 pl-3 border-l-2 border-gray-200 dark:border-gray-700">
                  <NumberSliderField
                    label="Conveyancing"
                    value={conveyancing}
                    onChange={setConveyancing}
                    min={0}
                    max={5000}
                    sliderMin={0}
                    sliderMax={3000}
                    step={50}
                    impact="negative"
                    prefix="$"
                  />
                  <NumberSliderField
                    label="Building Inspection"
                    value={buildingInspection}
                    onChange={setBuildingInspection}
                    min={0}
                    max={2000}
                    sliderMin={0}
                    sliderMax={1000}
                    step={25}
                    impact="negative"
                    prefix="$"
                  />
                  <NumberSliderField
                    label="Pest Inspection"
                    value={pestInspection}
                    onChange={setPestInspection}
                    min={0}
                    max={1000}
                    sliderMin={0}
                    sliderMax={600}
                    step={25}
                    impact="negative"
                    prefix="$"
                  />
                  <NumberSliderField
                    label="Registration Fees"
                    value={registrationFees}
                    onChange={setRegistrationFees}
                    min={0}
                    max={1000}
                    sliderMin={0}
                    sliderMax={600}
                    step={25}
                    impact="negative"
                    prefix="$"
                  />
                  <NumberSliderField
                    label="Searches"
                    value={searches}
                    onChange={setSearches}
                    min={0}
                    max={1000}
                    sliderMin={0}
                    sliderMax={500}
                    step={25}
                    impact="negative"
                    prefix="$"
                  />
                  <NumberSliderField
                    label="Loan Establishment Fee"
                    value={loanEstablishmentFee}
                    onChange={setLoanEstablishmentFee}
                    min={0}
                    max={2000}
                    sliderMin={0}
                    sliderMax={800}
                    step={25}
                    impact="negative"
                    prefix="$"
                  />
                  <NumberSliderField
                    label="Property Valuation"
                    value={propertyValuation}
                    onChange={setPropertyValuation}
                    min={0}
                    max={1000}
                    sliderMin={0}
                    sliderMax={500}
                    step={25}
                    impact="negative"
                    prefix="$"
                  />
                  <NumberSliderField
                    label="Home Insurance (first payment)"
                    value={homeInsurance}
                    onChange={setHomeInsurance}
                    min={0}
                    max={3000}
                    sliderMin={0}
                    sliderMax={1500}
                    step={25}
                    impact="negative"
                    prefix="$"
                  />
                  <NumberSliderField
                    label="Rate Adjustments"
                    value={rateAdjustments}
                    onChange={setRateAdjustments}
                    min={0}
                    max={2000}
                    sliderMin={0}
                    sliderMax={800}
                    step={25}
                    impact="negative"
                    prefix="$"
                  />
                  <NumberSliderField
                    label="Misc Upfront Cost"
                    value={miscUpfrontCost}
                    onChange={setMiscUpfrontCost}
                    min={0}
                    max={5000}
                    sliderMin={0}
                    sliderMax={2000}
                    step={25}
                    impact="negative"
                    prefix="$"
                  >
                    Anything not covered by the fields above.
                  </NumberSliderField>
                </div>
              )}
            </div>
          </div>

          {/* Property Expenses */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <DollarSign size={24} className="text-orange-600 dark:text-orange-400" />
              Property Expenses
            </h2>

            <button
              type="button"
              onClick={() => setShowPropertyExpenses(!showPropertyExpenses)}
              aria-expanded={showPropertyExpenses}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              {showPropertyExpenses ? '▾' : '▸'} Property expenses breakdown (subtotal: $
              {Math.round(monthlyPropertyExpenses).toLocaleString()}/month)
            </button>

            {showPropertyExpenses && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {propertyType !== 'house' && (
                    <SteppedExpenseField
                      field={strataFeesField}
                      label="Strata (quarterly)"
                      min={0}
                      max={20000}
                      sliderMax={5000}
                      step={100}
                      impact="negative"
                      prefix="$"
                    >
                      ≈ ${Math.round(strataFees / 4)}/month
                    </SteppedExpenseField>
                  )}

                  <SteppedExpenseField
                    field={utilitiesField}
                    label="Utilities (monthly)"
                    min={0}
                    max={2000}
                    sliderMax={600}
                    step={10}
                    impact="negative"
                    prefix="$"
                  />

                  <SteppedExpenseField
                    field={councilRatesField}
                    label="Council Rates (quarterly)"
                    min={0}
                    max={10000}
                    sliderMax={2000}
                    step={50}
                    impact="negative"
                    prefix="$"
                  >
                    ≈ ${Math.round(councilRates / 4)}/month
                  </SteppedExpenseField>

                  <SteppedExpenseField
                    field={insuranceField}
                    label="Insurance (monthly)"
                    min={0}
                    max={2000}
                    sliderMax={500}
                    step={10}
                    impact="negative"
                    prefix="$"
                  />

                  <SteppedExpenseField
                    field={maintenanceField}
                    label="Maintenance & Repairs (monthly)"
                    min={0}
                    max={2000}
                    sliderMax={500}
                    step={10}
                    impact="negative"
                    prefix="$"
                  />

                  <SteppedExpenseField
                    field={waterRatesField}
                    label="Water Rates (quarterly)"
                    min={0}
                    max={5000}
                    sliderMax={1000}
                    step={25}
                    impact="negative"
                    prefix="$"
                  >
                    ≈ ${Math.round(waterRates / 4)}/month
                  </SteppedExpenseField>

                  <SteppedExpenseField
                    field={miscPropertyExpenseField}
                    label="Misc Property Expense (monthly)"
                    min={0}
                    max={2000}
                    sliderMax={500}
                    step={10}
                    impact="negative"
                    prefix="$"
                  >
                    Anything not covered by the fields above (e.g. pest control, gardening).
                  </SteppedExpenseField>
                </div>

                {isInvestmentProperty && (
                  <div className="border-t border-orange-200 dark:border-orange-800 pt-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Investment Property</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SteppedExpenseField
                        field={landTaxField}
                        label="Land Tax (yearly)"
                        min={0}
                        max={50000}
                        sliderMax={10000}
                        step={100}
                        impact="negative"
                        prefix="$"
                      >
                        ≈ ${Math.round(landTax / 12)}/month
                      </SteppedExpenseField>

                      <SteppedExpenseField
                        field={propertyManagementField}
                        label="Property Management (monthly)"
                        min={0}
                        max={2000}
                        sliderMax={500}
                        step={10}
                        impact="negative"
                        prefix="$"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Income */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <DollarSign size={24} className="text-green-600 dark:text-green-400" />
              Income
            </h2>

            <button
              type="button"
              onClick={() => setShowIncome(!showIncome)}
              aria-expanded={showIncome}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              {showIncome ? '▾' : '▸'} Income breakdown (subtotal: ${weeklyIncome.toLocaleString()}/week)
            </button>

            {showIncome && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-md font-bold text-gray-700 dark:text-gray-200">💵 Income Sources</h3>
                <button
                  onClick={() => setShowAddIncome(!showAddIncome)}
                  aria-expanded={showAddIncome}
                  className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors"
                >
                  {showAddIncome ? '✕ Cancel' : '+ Add'}
                </button>
              </div>

              {/* Add income form */}
              {showAddIncome && (
                <div className="mb-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800 text-sm">
                  <div className="grid gap-3">
                    <div>
                      <label className="block font-medium text-gray-700 dark:text-gray-200 mb-1">Income Name</label>
                      <select
                        value={newIncomeCategory}
                        onChange={(e) => handleIncomeCategoryChange(e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        {INCOME_CATEGORIES.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                      {newIncomeCategory === 'Other' && (
                        <input
                          type="text"
                          value={newIncomeCustomName}
                          onChange={(e) => setNewIncomeCustomName(e.target.value)}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mt-2"
                          placeholder="e.g. Dividends, Side Business"
                        />
                      )}
                    </div>

                    {newIncomeCategory === 'Room Rent' ? (
                      <>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                          <input
                            type="checkbox"
                            checked={newIncomeIsShared}
                            onChange={(e) => setNewIncomeIsShared(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                          />
                          Shared room? (multiple people splitting this room)
                        </label>

                        {newIncomeIsShared && (
                          <div>
                            <label htmlFor="newIncomeNumPeopleSlider" className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Number of People: {newIncomeNumPeople}</label>
                            <input
                              id="newIncomeNumPeopleSlider"
                              type="range" min="2" max="6"
                              value={newIncomeNumPeople}
                              onChange={(e) => setNewIncomeNumPeople(Number(e.target.value))}
                              className="w-full h-2 bg-blue-200 dark:bg-blue-900 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        )}

                        <NumberSliderField
                          label={newIncomeIsShared ? 'Weekly Rent per Person' : 'Weekly Rent'}
                          value={newIncomeAmount}
                          onChange={setNewIncomeAmount}
                          min={0}
                          max={5000}
                          sliderMin={50}
                          sliderMax={1200}
                          step={10}
                          impact="positive"
                          prefix="$"
                        >
                          {newIncomeIsShared && `Total: $${(newIncomeAmount * newIncomeNumPeople).toLocaleString()}/week`}
                        </NumberSliderField>
                      </>
                    ) : newIncomeCategory === 'House Rent' ? (
                      <NumberSliderField
                        label="Weekly Rent"
                        value={newIncomeAmount}
                        onChange={setNewIncomeAmount}
                        min={0}
                        max={5000}
                        sliderMin={50}
                        sliderMax={1200}
                        step={10}
                        impact="positive"
                        prefix="$"
                      />
                    ) : (
                      <NumberSliderField
                        label="Weekly Amount ($)"
                        value={newIncomeAmount}
                        onChange={setNewIncomeAmount}
                        min={0}
                        max={50000}
                        sliderMin={0}
                        sliderMax={5000}
                        step={10}
                        impact="positive"
                        prefix="$"
                      />
                    )}

                    <div>
                      <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                        <input
                          type="checkbox"
                          checked={newIncomeIsGross}
                          onChange={(e) => setNewIncomeIsGross(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-purple-600 dark:text-purple-400 focus:ring-purple-500"
                        />
                        This is a gross (pre-tax) amount (otherwise assumed net/take-home)
                      </label>
                      {newIncomeIsGross && effectiveTaxRate > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Net at {effectiveTaxRate}% tax: ${Math.round((newIncomeCategory === 'Room Rent' && newIncomeIsShared ? newIncomeAmount * newIncomeNumPeople : newIncomeAmount) * (1 - effectiveTaxRate / 100)).toLocaleString()}/week
                        </p>
                      )}
                    </div>

                    <ScheduleFields form={incomeSchedule} color="green" accentColor="emerald" />

                    <button
                      onClick={addIncomeSource}
                      className="w-full py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700"
                    >
                      Add Income
                    </button>
                  </div>
                </div>
              )}

              {/* List of income sources */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {incomeSources.length === 0 && !showAddIncome && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center">No income sources added.</p>
                )}
                {incomeSources.map(income => (
                  <div key={income.id} className={`flex justify-between items-center p-2 rounded text-sm border ${income.isShared ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'}`}>
                    <div>
                      <p className="font-bold text-gray-800 dark:text-gray-100">
                        {income.isShared !== undefined ? (income.isShared ? 'Shared Room' : 'Single Room') : income.name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        ${income.amount}/week {income.isShared && <span className="text-blue-600 dark:text-blue-400 font-medium">({income.numPeople} × ${income.amountPerPerson} each) </span>}
                        {income.isGross && <span className="text-purple-600 dark:text-purple-400 font-medium">(Gross{effectiveTaxRate > 0 && ` → net $${Math.round(income.amount * (1 - effectiveTaxRate / 100)).toLocaleString()}/week`}) </span>}
                        • {formatScheduleLabel(income)}
                      </p>
                    </div>
                    <button onClick={() => removeIncomeSource(income.id)} className="text-red-500 font-bold px-2">✕</button>
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>

          {/* YOUR PERSONAL EXPENSES */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <ShoppingCart size={24} className="text-purple-600 dark:text-purple-400" />
              Your Personal Expenses
            </h2>

            <button
              type="button"
              onClick={() => setShowPersonalExpenses(!showPersonalExpenses)}
              aria-expanded={showPersonalExpenses}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              {showPersonalExpenses ? '▾' : '▸'} Personal expenses breakdown (subtotal: $
              {Math.round(monthlyPersonalExpenses).toLocaleString()}/month)
            </button>

            {showPersonalExpenses && (
            <div className="space-y-4 mt-4">
              {/* PERSONAL EXPENSES (TODO-66, merged with the former "Other
                  Expenses" section in TODO-85) - an addable/removable list,
                  same Schedule model as Income Sources.
                  Groceries/Transport/Phone-Internet are just starter items here
                  (seeded in config.default.json), not fixed fields - this
                  section absorbs what used to be the separately-labeled
                  "Exceptional Expenses" and "Other Expenses" cards. */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-md font-bold text-gray-700 dark:text-gray-200">Personal Expenses</h3>
                <button
                  onClick={() => setShowAddExceptExp(!showAddExceptExp)}
                  aria-expanded={showAddExceptExp}
                  className="px-3 py-1 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600 transition-colors"
                >
                  {showAddExceptExp ? '✕ Cancel' : '+ Add'}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2 mb-3">
                Routine costs (Groceries, Transport, Bills), lifestyle
                costs (Health, Subscriptions, Entertainment, Debt
                Repayment) or one-off/exceptional costs (a wedding, car
                repair) - pick a category below, or "Custom" for anything
                else, and "One-Time" or a repeat interval for each.
              </p>

              {showAddExceptExp && (
                <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800 text-sm">
                  <div className="grid gap-3">
                    <div>
                      <label className="block font-medium text-gray-700 dark:text-gray-200 mb-1">Expense Name</label>
                      <select
                        value={newExpCategory}
                        onChange={(e) => setNewExpCategory(e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        {PERSONAL_EXPENSE_CATEGORIES.map((category) => (
                          <option key={category}>{category}</option>
                        ))}
                      </select>
                      {newExpCategory === 'Custom' && (
                        <input
                          type="text"
                          value={newExpCustomName}
                          onChange={(e) => setNewExpCustomName(e.target.value)}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mt-2"
                          placeholder="e.g. Pet Expenses, Childcare, Gym"
                        />
                      )}
                    </div>

                    <NumberSliderField
                      label="Monthly Amount ($)"
                      value={newExpAmount}
                      onChange={setNewExpAmount}
                      min={0}
                      max={500000}
                      impact="negative"
                      prefix="$"
                      hideSlider
                    />

                    <ScheduleFields form={expenseSchedule} color="yellow" accentColor="orange" />

                    <button
                      onClick={addPersonalExpense}
                      className="w-full py-2 bg-yellow-600 text-white rounded font-bold hover:bg-yellow-700"
                    >
                      Add Expense
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {personalExpenseItems.length === 0 && !showAddExceptExp && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center">No personal expenses added.</p>
                )}
                {personalExpenseItems.map(exp => (
                  <div key={exp.id} className="flex justify-between items-center p-2 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded text-sm">
                    <div>
                      <p className="font-bold text-gray-800 dark:text-gray-100">{exp.name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        ${exp.amount} • {formatScheduleLabel(exp)}
                      </p>
                    </div>
                    <button onClick={() => removePersonalExpense(exp.id)} className="text-red-500 font-bold px-2">✕</button>
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>

        </div>

        {/* RIGHT PANEL - Results */}
        <div className="space-y-4">

          {/* Property Balance */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-3">🏠 Property Balance</h2>
            <div className="space-y-4 text-sm"> {/* Increased spacing between sections */}

              {/* Loan details section */}
              <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">🏠 Loan Information</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Repayments:</span>
                    <span className="text-gray-700 dark:text-gray-200 font-medium">${Math.round(monthlyPayment).toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Interest Amount (monthly):</span>
                    <span className="text-orange-600 dark:text-orange-400">-${firstMonthInterest.toLocaleString()}</span>
                    {firstMonthOffset > 0 && <span className="text-xs text-green-600 dark:text-green-400 ml-1 self-center">(offset applied)</span>}
                  </div>
                </div>
              </div>

              {/* Upfront Costs section */}
              <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">🏛️ Upfront Costs ({stateModule.code})</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">
                      Stamp Duty{isFirstHomeBuyer && ' (FHB concession)'}:
                    </span>
                    <span className="font-semibold text-red-600 dark:text-red-400">-${Math.round(stampDuty).toLocaleString()}</span>
                  </div>
                  {isForeignPurchaser && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Foreign Purchaser Surcharge ({Math.round(stateModule.foreignPurchaserSurchargeRate * 100)}%):</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">-${Math.round(foreignPurchaserSurcharge).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">
                      LMI (estimate, {lvr.toFixed(1)}% LVR):
                      <LvrBadge lvr={lvr} />
                      <InfoTooltip label="What is LMI, and why is it often $0?">
                        <p>Lenders Mortgage Insurance (LMI) is a one-off premium lenders charge when your deposit is below 20% of the property price (LVR above 80%). It protects the lender, not you.</p>
                        <p className="mt-2">Below 80% LVR, no LMI applies at all - that's why this often shows $0. When it does apply, it's added to (financed into) the loan by default; check "Pay LMI upfront in cash" above to pay it as cash instead.</p>
                      </InfoTooltip>
                    </span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      {lmi > 0 ? `-$${Math.round(lmi).toLocaleString()}` : '$0'}
                      {lmi > 0 && !payLmiUpfront && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-normal ml-1">(financed into loan)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Closing Costs:</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">-${closingCostsSubtotal.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-purple-200 dark:border-purple-800 pt-1 mt-1 font-bold">
                    <div className="flex justify-between">
                      <span className="text-gray-700 dark:text-gray-200">
                        Total Cash Required:
                        <InfoTooltip label="What does Total Cash Required add up?">
                          <p>Deposit + Stamp Duty + Closing Costs, plus the Foreign Purchaser Surcharge and/or LMI when they apply and you've chosen to pay LMI upfront.</p>
                          <p className="mt-2">This is the cash you need ready on settlement day - separate from the loan itself, and separate from your ongoing monthly income/expenses.</p>
                        </InfoTooltip>
                      </span>
                      <span className="text-red-700 dark:text-red-400">${Math.round(totalCashRequired).toLocaleString()}</span>
                    </div>
                  </div>
                  {totalScheduledOffset > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">One-Time Offset Contributions:</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">-${totalScheduledOffset.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Available Savings:</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-200">${totalSavings.toLocaleString()}</span>
                  </div>
                </div>
                {/* Deliberately a SIBLING of the space-y-1 div above, not its last
                    child - space-y-1 sets margin-bottom: 0 on its last child via a
                    higher-specificity selector, which silently overrode -mb-3 and
                    left a gap of the card's own bg peeking through underneath.
                    -mx-3 -mb-3 (canceling the card's own p-3) + matching px-3 pb-3
                    pushes this highlight out to the card's actual edges/bottom
                    corner instead of stopping short. */}
                <div className={`border-t pt-1 mt-1 -mx-3 -mb-3 px-3 pb-3 rounded-b-lg font-bold ${getBalanceBgColor(cashRemaining)}`}>
                  <div className="flex justify-between">
                    <span className="text-gray-700 dark:text-gray-200">
                      Remaining Savings:
                      <InfoTooltip label="How is Remaining Savings different from Available Savings?">
                        <p>Available Savings − Total Cash Required − any one-time Offset Contributions you've already scheduled (recurring contributions aren't counted here, since they come out of future income, not savings sitting in the bank today).</p>
                        <p className="mt-2">This is what's left in savings right after settlement - it doesn't include your ongoing monthly surplus (see 🎯 TO OFFSET below for that).</p>
                      </InfoTooltip>
                    </span>
                    <span className={getBalanceColor(cashRemaining)}>
                      {cashRemaining >= 0 ? '+' : '-'}${Math.abs(Math.round(cashRemaining)).toLocaleString()}
                    </span>
                  </div>
                  {cashRemaining < 0 && (
                    <p className="mt-2 p-2 bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-700 rounded text-xs text-red-700 dark:text-red-400 font-normal">
                      ⚠️ You've committed ${Math.abs(Math.round(cashRemaining)).toLocaleString()} more than your
                      savings cover (deposit + upfront costs + scheduled contributions).
                    </p>
                  )}
                </div>
              </div>

              {/* Monthly expenses section */}
              <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">💳 Monthly Expenses</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Loan Payment (monthly):</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">-${Math.round(monthlyPayment).toLocaleString()}</span>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setShowMonthlyExpensesBreakdown(!showMonthlyExpensesBreakdown)}
                      aria-expanded={showMonthlyExpensesBreakdown}
                      className="w-full flex justify-between items-center text-left"
                    >
                      <span className="text-gray-600 dark:text-gray-300">
                        {showMonthlyExpensesBreakdown ? '▾' : '▸'} Property Expenses:
                      </span>
                      <span className="font-semibold text-red-600 dark:text-red-400">-${Math.round(monthlyPropertyExpenses).toLocaleString()}</span>
                    </button>

                    {showMonthlyExpensesBreakdown && (
                      <div className="pl-4 mt-1 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Strata:</span>
                          <span className="text-red-500">-${Math.round(monthlyStrata).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Council:</span>
                          <span className="text-red-500">-${Math.round(monthlyCouncil).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Utilities:</span>
                          <span className="text-red-500">-${utilities.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Insurance:</span>
                          <span className="text-red-500">-${insurance.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Maintenance & Repairs:</span>
                          <span className="text-red-500">-${maintenance.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Water Rates:</span>
                          <span className="text-red-500">-${Math.round(monthlyWaterRates).toLocaleString()}</span>
                        </div>
                        {isInvestmentProperty && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Land Tax:</span>
                              <span className="text-red-500">-${Math.round(monthlyLandTax).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Property Management:</span>
                              <span className="text-red-500">-${propertyManagement.toLocaleString()}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Misc:</span>
                          <span className="text-red-500">-${Math.round(miscPropertyExpense).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="w-full flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => setShowPersonalExpensesBreakdown(!showPersonalExpensesBreakdown)}
                        aria-expanded={showPersonalExpensesBreakdown}
                        className="text-left text-gray-600 dark:text-gray-300"
                      >
                        {showPersonalExpensesBreakdown ? '▾' : '▸'} Personal Expenses:
                      </button>
                      <span className="flex items-center">
                        <span className="font-semibold text-red-600 dark:text-red-400 ml-1">-${Math.round(monthlyPersonalExpenses).toLocaleString()}</span>
                      </span>
                    </div>

                    {showPersonalExpensesBreakdown && (
                      <div className="pl-4 mt-1 space-y-1 text-xs">
                        {personalExpenseItems.filter(item => isScheduleActive(item, 1)).map(item => (
                          <div key={item.id} className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">{item.name}:</span>
                            <span className="text-red-500">-${Math.round(item.amount).toLocaleString()}</span>
                          </div>
                        ))}
                        {personalExpenseItems.filter(item => isScheduleActive(item, 1)).length === 0 && (
                          <span className="italic text-gray-400 dark:text-gray-500">No personal expenses active this month</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-orange-200 dark:border-orange-800 pt-1 mt-1 font-bold">
                    <div className="flex justify-between">
                      <span className="text-gray-700 dark:text-gray-200">Total Monthly Expenses:</span>
                      <span className="text-red-700 dark:text-red-400">-${Math.round(totalPropertyCost + monthlyPersonalExpenses).toLocaleString()}/month</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Income section */}
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 border border-green-200 dark:border-green-800">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  💰 Monthly Income
                  <InfoTooltip label="How are these monthly income figures calculated?">{WEEKLY_TO_MONTHLY_TOOLTIP}</InfoTooltip>
                </h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Monthly Rental Income:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">+${Math.round(monthlyRentalIncome).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Total Personal Income:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">+${Math.round(monthlyIncome).toLocaleString()}</span>
                  </div>
                  <div className="border-t border-green-200 dark:border-green-800 pt-1 mt-1 font-bold">
                    <div className="flex justify-between">
                      <span className="text-gray-700 dark:text-gray-200">Total Monthly Income:</span>
                      <span className="text-green-700 dark:text-green-400">+${Math.round(monthlyRentalIncome + monthlyIncome).toLocaleString()}/month</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Property Summary section - only meaningful when the property actually
                  earns rental income; otherwise it's just expenses restated as a
                  negative "balance" against nothing, which duplicates Monthly Expenses. */}
              {monthlyRentalIncome > 0 && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">📊 Property Summary</h3>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Total Property Monthly Expenses:</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">-${Math.round(totalPropertyCost).toLocaleString()}/month</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Total Property Monthly Income:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">+${Math.round(monthlyRentalIncome).toLocaleString()}/month</span>
                    </div>
                    <div className="border-t border-gray-300 dark:border-gray-600 pt-1 mt-1 font-bold">
                      <div className="flex justify-between">
                        <span className="text-gray-700 dark:text-gray-200">Net Property Monthly Balance:</span>
                        <span className={(monthlyRentalIncome - totalPropertyCost) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {(monthlyRentalIncome - totalPropertyCost) >= 0 ? '+' : '-'}${Math.abs(Math.round(monthlyRentalIncome - totalPropertyCost)).toLocaleString()}/month
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Total Summary section */}
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700 mt-4">
                <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-3">💵 Total Summary</h3>

                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-16 h-16 rounded-full shadow-inner" style={{
                    background: `conic-gradient(#ef4444 ${expenseRatio}%, #22c55e 0)`
                  }}>
                    <div className="absolute inset-2 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                        {Math.round(expenseRatio)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-1 text-gray-700 dark:text-gray-200"><div className="w-2 h-2 bg-green-500 rounded-full"></div> Income</div>
                    <div className="flex items-center gap-1 text-gray-700 dark:text-gray-200"><div className="w-2 h-2 bg-red-500 rounded-full"></div> Expenses</div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Total Monthly Expenses:</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">-${Math.round(totalPropertyCost + monthlyPersonalExpenses).toLocaleString()}/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Total Monthly Income:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">+${Math.round(monthlyRentalIncome + monthlyIncome).toLocaleString()}/month</span>
                  </div>
                  <div className="border-t border-slate-300 dark:border-slate-600 pt-1 mt-1 font-bold">
                    <div className="flex justify-between">
                      <span className="text-gray-700 dark:text-gray-200">Net Monthly Balance:</span>
                      <span className={(monthlyRentalIncome + monthlyIncome) - (totalPropertyCost + monthlyPersonalExpenses) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {(monthlyRentalIncome + monthlyIncome) - (totalPropertyCost + monthlyPersonalExpenses) >= 0 ? '+' : ''}
                        ${Math.round((monthlyRentalIncome + monthlyIncome) - (totalPropertyCost + monthlyPersonalExpenses)).toLocaleString()}/month
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status message */}
              <p className={`text-center text-xs px-2 py-1 rounded ${(monthlyRentalIncome + monthlyIncome) >= (totalPropertyCost + monthlyPersonalExpenses) ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-400'}`}>
                {(monthlyRentalIncome + monthlyIncome) >= (totalPropertyCost + monthlyPersonalExpenses)
                  ? `✅ Income covers all expenses. (+$${Math.round((monthlyRentalIncome + monthlyIncome) - (totalPropertyCost + monthlyPersonalExpenses)).toLocaleString()})`
                  : `❌ Need $${Math.round((totalPropertyCost + monthlyPersonalExpenses) - (monthlyRentalIncome + monthlyIncome))}/month extra`
                }
              </p>
            </div>
          </div>

          {/* Purchase Health Check (TODO-68/69/70) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                🩺 Purchase Health Check
              </h2>
              <button
                type="button"
                onClick={() => setShowHealthCheck(!showHealthCheck)}
                aria-expanded={showHealthCheck}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                {showHealthCheck ? '▾ Hide' : '▸ Show'}
              </button>
            </div>

            {showHealthCheck && (
              <>
                {healthCheckHasCritical && (
                  <div className="mb-3 p-3 bg-red-100 dark:bg-red-900 rounded text-red-800 dark:text-red-400 text-sm font-semibold">
                    ⚠️ One or more indicators below need attention - not financial advice, just standard rules of thumb.
                  </div>
                )}

                <HealthCheckIndicator
                  label="Emergency Buffer"
                  tooltipLabel="What is the Emergency Buffer?"
                  valueDisplay={bufferDisplay(emergencyBufferMonths, liquidSavings)}
                  secondaryValueDisplay={`${stabilizedArrow(emergencyBufferMonths, stabilizedEmergencyBufferMonths, 'higherIsBetter')} stabilizes to ${bufferDisplay(stabilizedEmergencyBufferMonths, liquidSavings)}`}
                  classification={liquidSavings < 0 ? { ...emergencyBufferClass, action: bufferShortfallAction(liquidSavings) } : emergencyBufferClass}
                >
                  <p>Your savings left after settlement, divided by your total monthly outgoings (property + personal expenses) - how many months you could cover if income stopped entirely.</p>
                  <p className="mt-2">Cash you've scheduled into the offset still counts here: it stays your money and stays available, and the simulation itself draws the offset down first to cover a shortfall. That's why this figure is higher than "Cash Remaining" above, which only counts uncommitted cash.</p>
                  <p className="mt-2">≥12 months excellent, 6-12 good, 3-6 moderate, &lt;3 high risk - the standard "3-6 months" rule of thumb.</p>
                  <p className="mt-2">"Stabilizes to" reflects month {stabilizationMonth} - your last scheduled income/expense change, or year 5 if nothing's scheduled - with growth rates applied.</p>
                </HealthCheckIndicator>

                <HealthCheckIndicator
                  label="Housing Cost Ratio"
                  tooltipLabel="What is the Housing Cost Ratio?"
                  valueDisplay={`${housingCostRatio.toFixed(0)}%`}
                  secondaryValueDisplay={`${stabilizedArrow(housingCostRatio, stabilizedHousingCostRatio, 'higherIsWorse')} stabilizes to ${stabilizedHousingCostRatio.toFixed(0)}%`}
                  classification={housingCostRatioClass}
                >
                  <p>Total property cost (loan repayment + property expenses) as a share of your total monthly income.</p>
                  <p className="mt-2">&lt;30% excellent, 30-40% good, 40-50% caution, ≥50% high risk.</p>
                  <p className="mt-2">"Stabilizes to" reflects month {stabilizationMonth} - your last scheduled income/expense change, or year 5 if nothing's scheduled - with growth rates applied.</p>
                </HealthCheckIndicator>

                <HealthCheckIndicator
                  label="Interest Rate Stress Test"
                  tooltipLabel="What is the Interest Rate Stress Test?"
                  valueDisplay={stressTestDisplay(stressTestSurvivedDelta, alreadyInDeficitAtCurrentRate)}
                  secondaryValueDisplay={`${stabilizedArrow(stressTestSurvivedDelta, stabilizedStressTestSurvivedDelta, 'higherIsBetter')} stabilizes to ${stressTestDisplay(stabilizedStressTestSurvivedDelta, stabilizedAlreadyInDeficit)}`}
                  classification={stressTestClass}
                >
                  <p>Recalculates your repayment at today's rate plus 1/2/3 percentage points, and reports the largest rise your current cash flow still survives without going into deficit.</p>
                  <p className="mt-2">Survives +3% excellent, +2% good, +1% moderate, fails already at +1% high risk.</p>
                  <p className="mt-2">"Stabilizes to" reflects month {stabilizationMonth} - your last scheduled income/expense change, or year 5 if nothing's scheduled - with growth rates applied.</p>
                </HealthCheckIndicator>

                <HealthCheckIndicator
                  label="Upfront Cost Ratio"
                  tooltipLabel="What is the Upfront Cost Ratio?"
                  valueDisplay={`${upfrontCostRatio.toFixed(1)}%`}
                  classification={upfrontCostRatioClass}
                >
                  <p>Stamp duty, LMI (if paid upfront) and closing costs - excluding the deposit itself - as a share of the property price.</p>
                  <p className="mt-2">&lt;2% excellent, 2-4% normal, ≥4% high.</p>
                </HealthCheckIndicator>

                {fhbConcessionLost && (
                  <div className="py-2 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-orange-600 dark:text-orange-400 font-semibold">
                      ⚠️ First Home Buyer concession is partially or fully gone at this price - double check {stateModule.code}'s concession thresholds.
                    </p>
                  </div>
                )}

                {isInvestmentProperty && (
                  <>
                    <HealthCheckIndicator
                      label="Gearing"
                      tooltipLabel="What does Gearing mean here?"
                      valueDisplay={`${gearingCashflow >= 0 ? '+' : '-'}$${Math.abs(Math.round(gearingCashflow)).toLocaleString()}/mo`}
                      secondaryValueDisplay={`${stabilizedArrow(gearingCashflow, stabilizedGearingCashflow, 'higherIsBetter')} stabilizes to ${stabilizedGearingCashflow >= 0 ? '+' : '-'}$${Math.abs(Math.round(stabilizedGearingCashflow)).toLocaleString()}/mo`}
                      classification={gearingClass}
                    >
                      <p>Rental income minus the loan repayment and property expenses. Not itself good or bad - negative gearing (a shortfall) just needs to be affordable from your other income.</p>
                      <p className="mt-2">"Stabilizes to" reflects month {stabilizationMonth} - your last scheduled income/expense change, or year 5 if nothing's scheduled - with growth rates applied.</p>
                    </HealthCheckIndicator>

                    <HealthCheckIndicator
                      label="Vacancy Buffer"
                      tooltipLabel="What is the Vacancy Buffer?"
                      valueDisplay={bufferDisplay(vacancyBufferMonths, liquidSavings)}
                      secondaryValueDisplay={`${stabilizedArrow(vacancyBufferMonths, stabilizedVacancyBufferMonths, 'higherIsBetter')} stabilizes to ${bufferDisplay(stabilizedVacancyBufferMonths, liquidSavings)}`}
                      classification={liquidSavings < 0 ? { ...vacancyBufferClass, action: bufferShortfallAction(liquidSavings) } : vacancyBufferClass}
                    >
                      <p>Your savings left after settlement (including anything scheduled into the offset, which stays yours and stays available) divided by the loan repayment + property expenses - how many months you could cover the property alone with no tenant.</p>
                      <p className="mt-2">≥6 months excellent, 3-6 good, &lt;3 high risk.</p>
                      <p className="mt-2">"Stabilizes to" reflects month {stabilizationMonth} - your last scheduled income/expense change, or year 5 if nothing's scheduled - with growth rates applied.</p>
                    </HealthCheckIndicator>

                    {rentalYieldHasData ? (
                      <HealthCheckIndicator
                        label="Rental Yield"
                        tooltipLabel="What is Rental Yield?"
                        valueDisplay={`${rentalYield.toFixed(1)}%`}
                        secondaryValueDisplay={`${stabilizedArrow(rentalYield, stabilizedRentalYield, 'higherIsBetter')} stabilizes to ${stabilizedRentalYield.toFixed(1)}%`}
                        classification={rentalYieldClass}
                      >
                        <p>Annualized rental income (House Rent/Room Rent) as a share of the property price.</p>
                        <p className="mt-2">&lt;3% weak, 3-5% average, ≥5% strong.</p>
                        <p className="mt-2">"Stabilizes to" reflects month {stabilizationMonth} - your last scheduled income/expense change, or year 5 if nothing's scheduled - with growth rates applied.</p>
                      </HealthCheckIndicator>
                    ) : (
                      <div className="py-2 text-sm text-gray-400 dark:text-gray-500 italic">
                        Rental Yield: not enough data yet - add a House Rent/Room Rent income source.
                      </div>
                    )}
                  </>
                )}

                {mortgageFreeAgeClass && (
                  <HealthCheckIndicator
                    label="Mortgage-Free Age"
                    tooltipLabel="What is Mortgage-Free Age?"
                    valueDisplay={`${Math.round(mortgageFreeAge)}`}
                    classification={mortgageFreeAgeClass}
                  >
                    <p>Your current age plus how long the loan simulation takes to pay off.</p>
                    <p className="mt-2">&lt;60 comfortably early, 60-67 reasonable, 67-70 cutting it close, &gt;70 late - based on typical retirement age.</p>
                  </HealthCheckIndicator>
                )}
              </>
            )}
          </div>

          {/* WHAT GOES TO OFFSET */}
          <div className={`rounded-lg shadow-lg p-6 border-2 ${getBalanceBgColor(monthlyNetBalance)}`}>
            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-3 text-center">
              {etfInvestingActive && etfAllocationPct > 0 ? '🎯 MONTHLY SURPLUS (automatic)' : '🎯 TO OFFSET (automatic)'}
            </h2>

            <div className="text-center mb-4">
              <p className={`text-4xl font-bold ${getBalanceColor(monthlyNetBalance)}`}>
                ${Math.round(monthlyToOffset)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">per month</p>
            </div>

            {/* TODO-136: the direct Offset/ETF split of the same total surplus -
                display-only, the actual per-month split happens inside
                offsetSimulation.js's loop against the real monthly figures,
                not this static "right now" one. */}
            {etfInvestingActive && etfAllocationPct > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-4 text-center">
                <div className="p-2 bg-white/60 dark:bg-black/20 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">To Offset ({100 - etfAllocationPct}%)</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                    ${Math.round(monthlyToOffset * (100 - etfAllocationPct) / 100).toLocaleString()}
                  </p>
                </div>
                <div className="p-2 bg-white/60 dark:bg-black/20 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">To ETF ({etfAllocationPct}%)</p>
                  <p className="text-lg font-bold text-purple-700 dark:text-purple-400">
                    ${Math.round(monthlyToOffset * etfAllocationPct / 100).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2 text-sm border-t pt-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Per week:</span>
                <span className="font-semibold text-gray-700 dark:text-gray-200">${Math.round(weeklyToOffset)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Per fortnight:</span>
                <span className="font-semibold text-gray-700 dark:text-gray-200">${Math.round(fortnightlyToOffset)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Per year:</span>
                <span className="font-semibold text-green-700 dark:text-green-400">${Math.round(monthlyToOffset * 12).toLocaleString()}</span>
              </div>
            </div>

            {monthlyNetBalance < 0 && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 rounded text-red-800 dark:text-red-400 text-xs">
                ⚠️ You're in deficit. Cannot sustain this without extra savings.
              </div>
            )}

            {monthlyNetBalance >= 0 && monthlyNetBalance < 300 && (
              <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900 rounded text-yellow-800 dark:text-yellow-400 text-xs">
                ⚠️ Tight margin. Little buffer for emergencies.
              </div>
            )}

            {monthlyNetBalance >= 300 && (
              <div className="mt-4 p-3 bg-green-100 dark:bg-green-900 rounded text-green-800 dark:text-green-400 text-xs">
                ✅ Excellent! Good margin and fast loan payoff.
              </div>
            )}
          </div>

          {/* Estimated time */}
          {(monthlyToOffset > 0 || totalScheduledOffset > 0) && (
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-5 shadow-lg text-white">
              <h3 className="font-bold mb-3 text-lg">⏱️ Loan Simulation</h3>
              {projectionIsFlatBaseline && (
                <p className="text-xs opacity-75 mb-3">
                  Every growth, vacancy and tax assumption is set to 0 - these figures are a flat baseline, not the most likely real-world outcome. Adjust them in Projection Assumptions.
                </p>
              )}
              {/* TODO-136: months where the deficit outlived the offset. This
                  used to be invisible - a shortfall was floored to zero and
                  the projection carried on as if the money had appeared.
                  Complements, doesn't duplicate, the "❌ Need $X/month extra"
                  status in Total Summary above: that one catches a month-1
                  shortfall from static figures, this one catches shortfalls
                  that only emerge DURING the projection (scheduled expenses,
                  a rate change, expense growth outpacing income). */}
              {loanSimulation.totalCashShortfall > 0 && (
                <div className="bg-red-900/40 border border-red-300/50 rounded-lg p-3 mb-3">
                  <p className="text-sm font-semibold">
                    ⚠️ Cash shortfall: ${Math.round(loanSimulation.totalCashShortfall).toLocaleString()} across {loanSimulation.monthsWithShortfall} month{loanSimulation.monthsWithShortfall === 1 ? '' : 's'}
                  </p>
                  <p className="text-xs opacity-90 mt-1">
                    In {loanSimulation.monthsWithShortfall === 1 ? 'that month' : 'those months'} your expenses exceed your income and your offset balance is already empty, so the figures below assume money you don't have. Cover it with more income, lower expenses, or a bigger starting balance.
                  </p>
                </div>
              )}
              <div className="space-y-3">
                <div className="bg-white/20 backdrop-blur rounded-lg p-3">
                  <p className="text-sm opacity-90 mb-1">Time to pay off:</p>
                  <p className="text-3xl font-bold">
                    {loanSimulation.years < 100 ? loanSimulation.years.toFixed(1) : '30+'} years
                  </p>
                  {loanSimulation.months < 360 && (
                    <>
                      <p className="text-sm opacity-75 mt-1">
                        {loanSimulation.months} months
                      </p>
                      <p className="text-xs opacity-75">
                        {formatMonthsDetailed(loanSimulation.months).human}
                      </p>
                    </>
                  )}
                </div>

                <div className="bg-white/20 backdrop-blur rounded-lg p-3">
                  <p className="text-sm opacity-90">Total interest paid:</p>
                  <p className="text-2xl font-bold">
                    ${Math.round(loanSimulation.totalInterest).toLocaleString()}
                  </p>
                  {inflationRate > 0 && (
                    <p className="text-xs opacity-75 mt-1">
                      ≈ ${Math.round(totalInterestInTodaysDollars).toLocaleString()} in today's dollars (at {inflationRate}% inflation)
                    </p>
                  )}
                </div>

                {savingsInterestRate > 0 && (
                  <div className="bg-white/20 backdrop-blur rounded-lg p-3">
                    <p className="text-sm opacity-90">Savings interest earned:</p>
                    <p className="text-2xl font-bold">
                      ${Math.round(loanSimulation.totalSavingsInterest).toLocaleString()}
                    </p>
                  </div>
                )}

                {offsetContributions.length > 1 && (
                  <div className="bg-cyan-400/30 backdrop-blur rounded-lg p-2 text-xs">
                    <p className="font-semibold">💰 Scheduled contributions:</p>
                    {oneTimeContributionsCount > 0 && (
                      <p>{oneTimeContributionsCount} one-time payment{oneTimeContributionsCount !== 1 ? 's' : ''} totaling ${totalScheduledOffset.toLocaleString()}</p>
                    )}
                    {recurringContributionsCount > 0 && (
                      <p>{recurringContributionsCount} recurring contribution{recurringContributionsCount !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                )}

                <div className="bg-white/20 backdrop-blur rounded-lg p-3 text-xs">
                  <p className="font-semibold mb-1">💰 Savings vs no offset:</p>
                  <p>Without offset ({loanTermYears} years): ~${Math.round(noOffsetTotalInterest).toLocaleString()}</p>
                  <p className="text-yellow-300 font-bold">
                    You save: ~${Math.round(noOffsetTotalInterest - loanSimulation.totalInterest).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* TIMELINE EXPLORER */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Calendar size={24} className="text-purple-600 dark:text-purple-400" />
              Timeline Explorer
              <InfoTooltip label="How This Calculator Works">
                <p><strong>Flow:</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Receive your income</li>
                  <li>Pay your personal expenses (food, transport, etc.)</li>
                  <li>Property has costs (loan payment + strata + utilities...)</li>
                  <li><strong>What's left after EVERYTHING → goes automatically to offset</strong></li>
                  <li>Offset reduces your interest and accelerates loan payoff</li>
                </ol>
                <p className="mt-2">
                  💡 Tip: The loan calculation includes the full offset effect. Monthly payment is always ${Math.round(monthlyPayment)}, but with offset you reduce interest and pay more principal each month, finishing the loan much sooner.
                </p>
              </InfoTooltip>
            </h2>

            {/* No month-by-month data means there is nothing to scrub through:
                either there is no loan, or no surplus and no contributions. */}
            {loanSimulation.monthlyData.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                {loanAmount <= 0
                  ? 'No loan to simulate — the deposit covers the full purchase price.'
                  : 'Nothing going into the offset yet, so there is no timeline to explore. Add income, reduce expenses, or schedule a contribution.'}
              </p>
            ) : (
            <>
            <div className="mb-6">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">Viewing Month</span>
                  <p className="text-3xl font-bold text-purple-700 dark:text-purple-400">{timelineMonth}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {Math.floor(timelineMonth / 12)} Years, {timelineMonth % 12} Months
                  </p>
                </div>
              </div>

              <input
                type="range"
                aria-label="Viewing month"
                min="0"
                max={loanSimulation.months}
                value={timelineMonth}
                onChange={(e) => setTimelineMonth(Number(e.target.value))}
                className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
                <span>Start</span>
                <span>Middle ({Math.round(loanSimulation.months / 2)})</span>
                <span>End ({loanSimulation.months})</span>
              </div>
            </div>

            {(() => {
              const snapshot = getTimelineSnapshot(timelineMonth, loanSimulation.monthlyData, loanAmount, monthZeroInterest, cashRemaining, propertyPrice);
              if (!snapshot) return null;

              const effectiveProgress = calculateEffectiveProgress(loanAmount, snapshot.effectiveBalance);
              const { years: yearsRem, months: monthsRem } = calculateTimeRemaining(loanSimulation.months, timelineMonth);

              return (
                <div className="space-y-6">
                  {/* PRIMARY STAT: NET EFFECTIVE BALANCE */}
                  <div className="bg-gradient-to-br from-gray-50 dark:from-gray-900 to-gray-100 dark:to-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 text-center shadow-sm">
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">Net Effective Balance</p>
                    <p className="text-4xl font-extrabold text-blue-900 mb-2">
                      ${snapshot.effectiveBalance.toLocaleString()}
                    </p>
                    <div className="flex justify-center gap-4 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1">🏦 Loan: ${snapshot.balance.toLocaleString()}</span>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <span className="flex items-center gap-1">💰 Offset: ${snapshot.offset.toLocaleString()}</span>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      {/* TODO-80/136: the starting cash position, seeded from
                          cashRemaining at month 0. Since TODO-136 removed the
                          ongoing savings destination, this only ever grows by
                          its own Savings Interest Rate - flat at the 0%
                          default. Monthly surplus goes to the offset/ETF. */}
                      <span className="flex items-center gap-1">🐖 Savings: ${snapshot.savings.toLocaleString()}</span>
                      {/* TODO-136: only appears in a month where the deficit
                          outlived the offset - real money the plan doesn't
                          cover, which used to be silently floored to zero. */}
                      {snapshot.cashShortfall > 0 && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">|</span>
                          <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">⚠️ Short: ${snapshot.cashShortfall.toLocaleString()}</span>
                        </>
                      )}
                      {/* TODO-89: only shown once the user opts in - at the
                          0% default, propertyValue is flat and this row
                          would just repeat the purchase price forever. */}
                      {propertyGrowthRate !== 0 && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">|</span>
                          <span className="flex items-center gap-1">🏠 Value: ${snapshot.propertyValue.toLocaleString()}</span>
                        </>
                      )}
                      {/* TODO-96: only shown once ETF investing is actually
                          active - at 0% allocation this would just be a
                          repeating $0 row. */}
                      {etfInvestingActive && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">|</span>
                          <span className="flex items-center gap-1">📈 ETF: ${snapshot.etf.toLocaleString()}</span>
                        </>
                      )}
                    </div>
                    {propertyGrowthRate !== 0 && (
                      <p className={`text-sm font-semibold mt-2 ${getBalanceColor(snapshot.propertyValue - snapshot.balance)}`}>
                        🏠 Projected Equity: ${(snapshot.propertyValue - snapshot.balance).toLocaleString()}
                      </p>
                    )}
                    {/* TODO-96: broader than Projected Equity above (which
                        deliberately excludes offset/savings/ETF) - everything
                        owned (property equity + all liquid balances) minus
                        what's owed (already netted into equity). Gated on
                        ETF investing being active, not propertyGrowthRate,
                        since it's meaningful even with a flat property value. */}
                    {etfInvestingActive && (
                      <p className={`text-sm font-semibold mt-1 ${getBalanceColor(snapshot.propertyValue - snapshot.balance + snapshot.offset + snapshot.savings + snapshot.etf)}`}>
                        💎 Net Worth: ${(snapshot.propertyValue - snapshot.balance + snapshot.offset + snapshot.savings + snapshot.etf).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* TODO-70: tied to whichever month the slider above is on,
                      not a single static "right now" figure like the rest of
                      the Purchase Health Check panel. */}
                  <HealthCheckIndicator
                    label="Offset Utilisation (this month)"
                    tooltipLabel="What is Offset Utilisation?"
                    valueDisplay={`${calculateOffsetUtilisation(snapshot.offset, snapshot.balance).toFixed(1)}%`}
                    classification={classifyOffsetUtilisation(calculateOffsetUtilisation(snapshot.offset, snapshot.balance))}
                  >
                    <p>Offset balance divided by (offset + remaining loan balance) at the month selected above - how much of what you still owe is already covered by your offset. A snapshot of the selected month, not a guarantee of future progress - a deficit month can drain the offset instead of growing it.</p>
                    <p className="mt-2">&gt;20% strong, 10-20% moderate, 5-10% low, &lt;5% just started.</p>
                  </HealthCheckIndicator>

                  {/* SECONDARY METRICS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-100 dark:border-orange-800 text-center">
                      <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase mb-1">Interest (Monthly)</p>
                      <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        Paying ~${snapshot.monthlyInterestPaid.toLocaleString()}/mo
                      </p>
                      <p className="text-xs text-orange-400 mt-1">at this point in time</p>
                    </div>

                    <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-100 dark:border-purple-800 text-center">
                      <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase mb-1">Interest Paid (Total)</p>
                      <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        ${snapshot.totalInterestPaid.toLocaleString()}
                      </p>
                      <p className="text-xs text-purple-400 mt-1">accumulated so far</p>
                    </div>

                    <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-100 dark:border-blue-800 text-center">
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Time Remaining</p>
                      <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        {yearsRem}y {monthsRem}m
                      </p>
                      <p className="text-xs text-blue-400 mt-1">until mortgage free</p>
                    </div>
                  </div>

                  {/* PROGRESS BAR */}
                  <div className="mt-2">
                    <div className="flex justify-between text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                      <span>Effective Ownership</span>
                      <span>{effectiveProgress.toFixed(1)}% Owned</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden relative">
                      <div
                        className="h-full bg-green-500 transition-all duration-300 absolute left-0"
                        style={{ width: `${effectiveProgress}%` }}
                      ></div>
                      {/* Marker for where pure principal payment is */}
                      <div
                        className="h-full border-r-2 border-white/50 absolute top-0"
                        style={{ left: `${safePercentage(snapshot.totalPrincipalPaid, loanAmount, 100)}%` }}
                        title="Principal Paid (Direct)"
                      ></div>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-center">
                      (Green bar = Principal Paid + Money sitting in Offset)
                    </p>
                  </div>

                  {/* EVENTS & STATUS LOG */}
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                      📅 Financial Events Log <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(at Month {timelineMonth})</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">

                      {/* COLUMN 1: INCOME CONTEXT */}
                      <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 border border-green-100 dark:border-green-800">
                        <p className="font-bold text-green-800 dark:text-green-400 border-b border-green-200 dark:border-green-800 pb-1 mb-2">
                          Income Context
                          <InfoTooltip label="How are these monthly income figures calculated?">{WEEKLY_TO_MONTHLY_TOOLTIP}</InfoTooltip>
                        </p>
                        <div className="space-y-1 text-xs">
                          {(() => {
                            const houseRentActiveHere = incomeSources.filter(i => RENTAL_INCOME_CATEGORIES.includes(i.name) && isScheduleActive(i, timelineMonth));
                            const rentalIncomeHere = calculateMonthlyFromWeekly(getActiveAmount(incomeSources.filter(i => RENTAL_INCOME_CATEGORIES.includes(i.name)), timelineMonth, effectiveTaxRate));
                            const personalIncomeHere = calculateMonthlyFromWeekly(getActiveAmount(incomeSources.filter(i => !RENTAL_INCOME_CATEGORIES.includes(i.name)), timelineMonth, effectiveTaxRate));
                            return (
                              <>
                                <p className="flex justify-between">
                                  <span>Personal Income:</span>
                                  <span className="font-medium">${Math.round(personalIncomeHere).toLocaleString()}/mo</span>
                                </p>
                                <p className="flex justify-between">
                                  <span>Rental Active:</span>
                                  <span className="font-medium">{houseRentActiveHere.length}</span>
                                </p>
                                <p className="flex justify-between">
                                  <span>Rental Income:</span>
                                  <span className="font-medium">${Math.round(rentalIncomeHere).toLocaleString()}/mo</span>
                                </p>
                              </>
                            );
                          })()}
                          <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                            {incomeSources.map(inc => {
                              const status = classifyScheduleStatus(inc, timelineMonth);
                              if (status === 'future') return null;
                              return (
                                <p key={`income-${inc.id}`} className={`truncate ${status === 'past' ? 'text-gray-400 dark:text-gray-500' : 'text-green-700 dark:text-green-400'}`}>
                                  • {inc.isShared !== undefined ? `${inc.isShared ? `Shared (${inc.numPeople} × $${inc.amountPerPerson})` : 'Single Room'}` : inc.name}
                                  {status === 'past' && ' (Done)'}
                                </p>
                              );
                            })}
                            {incomeSources.length === 0 && (
                              <span className="italic text-gray-400 dark:text-gray-500">No house rent or income sources</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* COLUMN 2: OFFSET HISTORY */}
                      <div className="bg-cyan-50 dark:bg-cyan-950 rounded-lg p-3 border border-cyan-100 dark:border-cyan-800">
                        <p className="font-bold text-cyan-800 dark:text-cyan-400 border-b border-cyan-200 dark:border-cyan-800 pb-1 mb-2">Offset History (Cumulative)</p>
                        <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
                          {offsetContributions
                            .filter(c => c.startMonth <= timelineMonth)
                            .sort((a, b) => b.startMonth - a.startMonth) // newest first
                            .map(c => (
                              <div key={c.id} className="flex justify-between items-center text-cyan-700 dark:text-cyan-400">
                                <span>{formatScheduleLabel(c)}:</span>
                                <span className="font-medium">
                                  +${(countOccurrencesUpTo(c, timelineMonth) * c.amount).toLocaleString()}
                                </span>
                              </div>
                            ))
                          }
                          {offsetContributions.filter(c => c.startMonth <= timelineMonth).length === 0 && (
                            <span className="italic text-gray-400 dark:text-gray-500">No contributions yet</span>
                          )}
                        </div>
                      </div>

                      {/* COLUMN 3: EXPENSE CONTEXT */}
                      <div className="bg-yellow-50 dark:bg-yellow-950 rounded-lg p-3 border border-yellow-100 dark:border-yellow-800">
                        <p className="font-bold text-yellow-800 dark:text-yellow-400 border-b border-yellow-200 dark:border-yellow-800 pb-1 mb-2">Expenses Status</p>
                        <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
                          {personalExpenseItems.map(exp => {
                            const status = classifyScheduleStatus(exp, timelineMonth);
                            if (status === 'future') return null;

                            return (
                              <div key={exp.id} className={`flex justify-between items-center ${status === 'active' ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-400 dark:text-gray-500'}`}>
                                <span>{exp.name} {status === 'past' && '(Done)'}</span>
                                <span className="font-medium">${exp.amount}</span>
                              </div>
                            );
                          })}
                          {personalExpenseItems.filter(e => e.startMonth <= timelineMonth).length === 0 && (
                            <span className="italic text-gray-400 dark:text-gray-500">No expenses recorded</span>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })()}
            </>
            )}
          </div>

      {/* Charts (TODO-51/65) - collapsed by default; the chart components
          only mount while expanded (conditional JSX below, not just
          conditional CSS visibility), so recharts' render work only
          happens while the card is actually open. */}
      {loanSimulation.monthlyData.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
          <button
            type="button"
            onClick={() => setShowProgressCharts(!showProgressCharts)}
            aria-expanded={showProgressCharts}
            className="font-bold text-gray-700 dark:text-gray-200 text-lg flex items-center gap-2"
          >
            {showProgressCharts ? '▾' : '▸'} 📈 Progress Over Time
          </button>
          {showProgressCharts && (
            <Suspense fallback={<p className="text-sm text-gray-500 dark:text-gray-400 mt-4">Loading charts...</p>}>
            <div className="space-y-6 mt-4">
              <div>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Loan Balance vs. Offset vs. Effective Balance</p>
                <LoanBalanceChart monthlyData={loanSimulation.monthlyData} isDarkMode={isDarkMode} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Principal vs. Interest (per month)</p>
                <PrincipalInterestChart monthlyData={loanSimulation.monthlyData} isDarkMode={isDarkMode} />
              </div>
            </div>
            </Suspense>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default PropertyInvestmentCalculator;