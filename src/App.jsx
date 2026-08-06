import React, { useState } from 'react';
import { DollarSign, Home, TrendingDown, Calendar, ShoppingCart, Car, RotateCcw, Wallet, Sun, Moon } from 'lucide-react';
import { formatMonthsDetailed, formatCompactMoney } from './calculations/formatting';
import NumberSliderField from './components/NumberSliderField';
import LvrBadge from './components/LvrBadge';
import InfoTooltip from './components/InfoTooltip';
import LoanBalanceChart from './components/LoanBalanceChart';
import PrincipalInterestChart from './components/PrincipalInterestChart';
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
import HealthCheckIndicator from './components/HealthCheckIndicator';
import { calculateTotalCashRequired, calculateCashRemaining } from './calculations/totalCashRequired';
import { getSteppedValue } from './calculations/steppedValue';
import { getActiveAmount, isScheduleActive, countOccurrencesUpTo, classifyScheduleStatus, formatScheduleLabel, MAX_MONTH } from './calculations/recurringAmount';
import { getTimelineSnapshot, calculateEffectiveProgress, calculateTimeRemaining } from './calculations/timelineSnapshot';
import { INCOME_CATEGORIES, INCOME_CATEGORY_DEFAULTS, RENTAL_INCOME_CATEGORIES } from './calculations/incomeCategories';
import { useSteppedValue } from './hooks/useSteppedValue';
import { useDarkMode } from './hooks/useDarkMode';
import SteppedExpenseField from './components/SteppedExpenseField';
import { loadScenario, saveScenario, clearScenario } from './persistence/scenarioStorage';
import { validateAmount, validateScheduleRange, hasDuplicateOneTimeMonth } from './calculations/scheduleFormValidation';
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

const PropertyInvestmentCalculator = () => {
  // Not stateful (no useState) - there's no UI to switch states yet, so this
  // is effectively a fixed config-level setting (TODO-58). Adding a state
  // selector later would just mean making this a useState like everything
  // else here.
  const stateModule = getStateModule(config.state ?? 'NSW');

  // A device/browser preference, not scenario data - deliberately its own
  // hook/localStorage key (TODO-47) so it survives "Reset to defaults".
  const [isDarkMode, toggleDarkMode] = useDarkMode();

  const [propertyPrice, setPropertyPrice] = useState(config.propertyPrice);
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
  // TODO-49: what share of the monthly surplus goes to the loan offset vs.
  // a separately-tracked savings balance - 100 (the default) preserves the
  // original "100% goes to offset automatically" behavior exactly.
  const [offsetAllocationPct, setOffsetAllocationPct] = useState(config.offsetAllocationPct ?? 100);
  // TODO-70: optional - 0 means "not provided", which hides the Mortgage-Free
  // Age indicator entirely rather than forcing anyone to disclose their age.
  const [currentAge, setCurrentAge] = useState(config.currentAge ?? 30);
  const [showMortgageFreeAge, setShowMortgageFreeAge] = useState(config.showMortgageFreeAge ?? false);
  const [payLmiUpfront, setPayLmiUpfront] = useState(false);
  // TODO-68/69/70: defaults open, unlike the "breakdown" toggles below -
  // this is a primary panel, not supplementary detail.
  const [showHealthCheck, setShowHealthCheck] = useState(config.showHealthCheck ?? true);
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
  const [showIncome, setShowIncome] = useState(config.showIncome ?? false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [newIncomeCategory, setNewIncomeCategory] = useState('Salary/Wages'); // see INCOME_CATEGORIES (src/calculations/incomeCategories.js)
  const [newIncomeCustomName, setNewIncomeCustomName] = useState(''); // only used when category is 'Other'
  const [newIncomeAmount, setNewIncomeAmount] = useState(config.newIncomeAmount);
  const [newIncomeIsShared, setNewIncomeIsShared] = useState(false); // only used when category is 'Room Rent'
  const [newIncomeNumPeople, setNewIncomeNumPeople] = useState(2); // only used when category is 'Room Rent' and shared
  const [newIncomeOneTime, setNewIncomeOneTime] = useState(false);
  const [newIncomeStartMonth, setNewIncomeStartMonth] = useState(1);
  const [newIncomeRecurrence, setNewIncomeRecurrence] = useState('monthly'); // monthly | quarterly | yearly
  const [newIncomeEndMonth, setNewIncomeEndMonth] = useState(MAX_MONTH);

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
  const [showAddContribution, setShowAddContribution] = useState(false);
  // Contributions default to one-time (unlike Income/Expenses, which default
  // to recurring) - preserves the pre-TODO-32 behavior where every
  // contribution was a single lump sum, with recurring now opt-in.
  const [newContribOneTime, setNewContribOneTime] = useState(true);
  const [newContribStartMonth, setNewContribStartMonth] = useState(1);
  const [newContribRecurrence, setNewContribRecurrence] = useState('monthly'); // monthly | quarterly | yearly
  const [newContribEndMonth, setNewContribEndMonth] = useState(MAX_MONTH);
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
  const [newExpOneTime, setNewExpOneTime] = useState(false);
  const [newExpStartMonth, setNewExpStartMonth] = useState(1);
  const [newExpRecurrence, setNewExpRecurrence] = useState('monthly'); // monthly | quarterly | yearly
  const [newExpEndMonth, setNewExpEndMonth] = useState(MAX_MONTH);

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
  const weeklyIncome = getActiveAmount(incomeSources.filter(i => !RENTAL_INCOME_CATEGORIES.includes(i.name)), 1);
  const weeklyRentalIncome = getActiveAmount(incomeSources.filter(i => RENTAL_INCOME_CATEGORIES.includes(i.name)), 1);
  const monthlyIncome = calculateMonthlyFromWeekly(weeklyIncome);
  const monthlyRentalIncome = calculateMonthlyFromWeekly(weeklyRentalIncome);

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
    offsetAllocationPct,
    initialSavingsBalance: cashRemaining,
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
    offsetAllocationPct,
    initialSavingsBalance: cashRemaining,
    maxMonths: totalMonths,
  });
  const interestSaved = baselineSimulation.totalInterest - loanSimulation.totalInterest;

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
  const emergencyBufferMonths = calculateEmergencyBufferMonths(cashRemaining, totalPropertyCost + monthlyPersonalExpenses);
  const emergencyBufferClass = classifyEmergencyBuffer(emergencyBufferMonths);

  const housingCostRatio = calculateHousingCostRatio(totalPropertyCost, monthlyIncome + monthlyRentalIncome);
  const housingCostRatioClass = classifyHousingCostRatio(housingCostRatio);

  const stressTestSurvivedDelta = calculateStressTestSurvivedDelta({
    loanAmount, interestRate, totalMonths, monthlyPropertyExpenses,
    monthlyIncome, monthlyRentalIncome, monthlyPersonalExpenses,
  });
  const stressTestClass = classifyStressTest(stressTestSurvivedDelta);

  const upfrontCostRatio = calculateUpfrontCostRatio(totalCashRequired, downPayment, propertyPrice);
  const upfrontCostRatioClass = classifyUpfrontCostRatio(upfrontCostRatio);

  // State-agnostic (per TODO-58) - reacts to the ALREADY-computed stampDuty
  // output rather than hardcoding any state's concession thresholds here.
  const fhbConcessionLost = isFirstHomeBuyer && stampDuty > 0;

  // TODO-69: investment-property-only indicators.
  const gearingCashflow = monthlyRentalIncome - monthlyPayment - monthlyPropertyExpenses;
  const gearingClass = classifyGearing(gearingCashflow);

  const vacancyBufferMonths = calculateVacancyBufferMonths(cashRemaining, monthlyPayment + monthlyPropertyExpenses);
  const vacancyBufferClass = classifyVacancyBuffer(vacancyBufferMonths);

  const rentalYieldHasData = hasEnoughDataForRentalYield(weeklyRentalIncome);
  const rentalYield = calculateRentalYield(weeklyRentalIncome, propertyPrice);
  const rentalYieldClass = rentalYieldHasData ? classifyRentalYield(rentalYield) : null;

  // TODO-88: Mortgage-Free Age is opt-in via showMortgageFreeAge, rather than
  // overloading currentAge itself as a "not provided" sentinel.
  const mortgageFreeAge = showMortgageFreeAge ? calculateMortgageFreeAge(currentAge, loanSimulation.years) : null;
  const mortgageFreeAgeClass = mortgageFreeAge !== null ? classifyMortgageFreeAge(mortgageFreeAge) : null;

  const healthCheckHasCritical = fhbConcessionLost || [emergencyBufferClass, housingCostRatioClass, stressTestClass, upfrontCostRatioClass].some((c) => c.critical);

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
      propertyPrice, propertyType, downPayment, loanTermYears,
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
      isFirstHomeBuyer, isForeignPurchaser, totalSavings, offsetAllocationPct, currentAge, showMortgageFreeAge, payLmiUpfront,
      conveyancing, buildingInspection, pestInspection, registrationFees, searches,
      loanEstablishmentFee, propertyValuation, homeInsurance, rateAdjustments, miscUpfrontCost,
      incomeSources,
      offsetContributions,
      personalExpenseItems,
      showPropertyExpenses, showMonthlyExpensesBreakdown, showClosingCostsBreakdown,
      showIncome, showPersonalExpenses, showPersonalExpensesBreakdown, showProgressCharts, showHealthCheck,
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
    if (!validateScheduleRange(newContribOneTime, newContribStartMonth, newContribEndMonth)) {
      alert('Start month must be before end month.');
      return;
    }

    // Only guards against two one-time lump sums landing on the exact same
    // month - two independent recurring contributions starting on the same
    // month aren't a conflict the way two one-time lumps in the same month are.
    if (newContribOneTime && hasDuplicateOneTimeMonth(offsetContributions, newContribStartMonth)) {
      alert('A contribution already exists for this month. Please remove it first or choose a different month.');
      return;
    }

    const newContrib = {
      id: Date.now(),
      amount: newContribAmount,
      startMonth: newContribStartMonth,
      recurrence: newContribOneTime ? 'none' : newContribRecurrence,
      ...(newContribOneTime ? {} : { endMonth: newContribEndMonth }),
    };

    const updatedContributions = [...offsetContributions, newContrib].sort((a, b) => a.startMonth - b.startMonth);
    setOffsetContributions(updatedContributions);
    setShowAddContribution(false);
    setNewContribStartMonth(getNextSuggestion(updatedContributions));
    setNewContribAmount(10000);
    setNewContribOneTime(true);
    setNewContribRecurrence('monthly');
    setNewContribEndMonth(MAX_MONTH);
  };

  const removeOffsetContribution = (id) => {
    const updatedContributions = offsetContributions.filter(c => c.id !== id);
    setOffsetContributions(updatedContributions);
    setNewContribStartMonth(getNextSuggestion(updatedContributions));
  };

  // Income Sources Functions

  // Applies each category's default Schedule (INCOME_CATEGORY_DEFAULTS) when
  // the user picks a new Income Name, so e.g. a Bonus starts as one-time and
  // a Salary starts as Monthly/Forever, instead of the form always defaulting
  // the same way regardless of category. Only touches the Schedule fields -
  // Room Rent's own Shared Room fields (isShared/numPeople) are untouched,
  // and categories without a listed default (House Rent, Room Rent, Other)
  // keep whatever the form's current Schedule fields already are.
  const handleIncomeCategoryChange = (category) => {
    setNewIncomeCategory(category);
    const defaults = INCOME_CATEGORY_DEFAULTS[category];
    if (!defaults) return;
    setNewIncomeOneTime(defaults.oneTime);
    if (!defaults.oneTime) {
      setNewIncomeRecurrence(defaults.recurrence);
      if (defaults.endMonth !== undefined) setNewIncomeEndMonth(defaults.endMonth);
    }
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
    if (!validateScheduleRange(newIncomeOneTime, newIncomeStartMonth, newIncomeEndMonth)) {
      alert('Start month must be before end month.');
      return;
    }

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
      startMonth: newIncomeStartMonth,
      recurrence: newIncomeOneTime ? 'none' : newIncomeRecurrence,
      ...(newIncomeOneTime ? {} : { endMonth: newIncomeEndMonth }),
      ...(isRoomRent ? { isShared: newIncomeIsShared, numPeople, amountPerPerson: newIncomeAmount } : {}),
    };

    setIncomeSources([...incomeSources, newIncome]);
    setShowAddIncome(false);
    setNewIncomeCategory('Salary/Wages');
    setNewIncomeCustomName('');
    setNewIncomeAmount(config.newIncomeAmount);
    setNewIncomeIsShared(false);
    setNewIncomeNumPeople(2);
    setNewIncomeOneTime(false);
    setNewIncomeStartMonth(1);
    setNewIncomeRecurrence('monthly');
    setNewIncomeEndMonth(MAX_MONTH);
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
    if (!validateScheduleRange(newExpOneTime, newExpStartMonth, newExpEndMonth)) {
      alert('Start month must be before end month.');
      return;
    }

    const newExp = {
      id: Date.now(),
      name,
      amount: newExpAmount,
      startMonth: newExpStartMonth,
      recurrence: newExpOneTime ? 'none' : newExpRecurrence,
      ...(newExpOneTime ? {} : { endMonth: newExpEndMonth }),
    };

    setPersonalExpenseItems([...personalExpenseItems, newExp]);
    setShowAddExceptExp(false);
    setNewExpCategory('Groceries');
    setNewExpCustomName('');
    setNewExpAmount(config.newExpAmount);
    setNewExpOneTime(false);
    setNewExpStartMonth(1);
    setNewExpRecurrence('monthly');
    setNewExpEndMonth(MAX_MONTH);
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
            {offsetAllocationPct === 100
              ? 'How much is left after EVERYTHING? That goes to offset automatically.'
              : `How much is left after EVERYTHING? ${offsetAllocationPct}% goes to your offset automatically, the rest builds your savings.`}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleDarkMode}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="shrink-0 p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-3 mb-4">
        <p className="text-xs text-amber-800 dark:text-amber-400">
          ⚠️ Personal project for illustrative purposes only — not financial advice. Always consult a licensed
          financial adviser before making property decisions.
        </p>
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

              <NumberSliderField
                label="Property Price"
                value={propertyPrice}
                onChange={handlePropertyPriceChange}
                min={50000}
                max={10000000}
                sliderMin={200000}
                sliderMax={3000000}
                step={10000}
                color="blue"
                prefix="$"
                suffix=" AUD"
                formatBound={formatCompactMoney}
              />

              <NumberSliderField
                label="Deposit Contribution"
                value={downPayment}
                onChange={handleDownPaymentChange}
                min={0}
                max={propertyPrice}
                sliderMax={propertyPrice}
                sliderMin={0}
                step={10000}
                color="green"
                prefix="$"
                suffix=" AUD"
                formatBound={formatCompactMoney}
              >
                Loan: ${loanAmount.toLocaleString()} ({lvr.toFixed(1)}% LVR)
                <LvrBadge lvr={lvr} />
              </NumberSliderField>

              <NumberSliderField
                label="Loan Amount"
                value={loanAmount}
                onChange={handleLoanAmountChange}
                min={0}
                max={propertyPrice}
                sliderMax={propertyPrice}
                sliderMin={0}
                step={10000}
                color="orange"
                prefix="$"
                suffix=" AUD"
                formatBound={formatCompactMoney}
              >
                Deposit: ${downPayment.toLocaleString()} ({(100 - lvr).toFixed(1)}% of price)
              </NumberSliderField>
            </div>
          </div>

          {/* Financial Position */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Wallet size={24} className="text-blue-600 dark:text-blue-400" />
              Financial Position
            </h2>

            <div className="space-y-4">
              <NumberSliderField
                label="Available Savings"
                value={totalSavings}
                onChange={setTotalSavings}
                min={0}
                max={10000000}
                sliderMin={0}
                sliderMax={3000000}
                step={10000}
                color="green"
                prefix="$"
                suffix=" AUD"
                formatBound={formatCompactMoney}
              >
                The whole savings pool the deposit and upfront costs come out of.
              </NumberSliderField>

              <NumberSliderField
                label="Offset Allocation"
                value={offsetAllocationPct}
                onChange={setOffsetAllocationPct}
                min={0}
                max={100}
                sliderMin={0}
                sliderMax={100}
                step={5}
                color="blue"
                suffix="%"
              >
                % of your monthly surplus that goes to the loan offset - the rest builds your savings balance instead. 100% (default) matches the original "everything goes to offset" behavior.
              </NumberSliderField>

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

              {/* min must stay above 0: a 0% rate makes calculateMonthlyPayment
                  divide 0 by 0, turning every figure on the page into NaN. */}
              <SteppedExpenseField
                field={interestRateField}
                label="Interest Rate"
                min={0.1}
                max={20}
                sliderMin={3}
                sliderMax={10}
                step={0.01}
                color="purple"
                suffix="% p.a."
                formatValue={(v) => v.toFixed(2)}
              />

              <NumberSliderField
                label="Loan Term"
                value={loanTermYears}
                onChange={setLoanTermYears}
                min={1}
                max={30}
                sliderMin={5}
                sliderMax={30}
                step={1}
                color="indigo"
                suffix=" years"
              />

              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Repayments: ${Math.round(monthlyPayment).toLocaleString()}
                </p>
              </div>
            </div>
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
                    color="orange"
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
                    color="orange"
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
                    color="orange"
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
                    color="orange"
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
                    color="orange"
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
                    color="orange"
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
                    color="orange"
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
                    color="orange"
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
                    color="orange"
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
                    color="orange"
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
                      color="orange"
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
                    color="orange"
                    prefix="$"
                  />

                  <SteppedExpenseField
                    field={councilRatesField}
                    label="Council Rates (quarterly)"
                    min={0}
                    max={10000}
                    sliderMax={2000}
                    step={50}
                    color="orange"
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
                    color="orange"
                    prefix="$"
                  />

                  <SteppedExpenseField
                    field={maintenanceField}
                    label="Maintenance & Repairs (monthly)"
                    min={0}
                    max={2000}
                    sliderMax={500}
                    step={10}
                    color="orange"
                    prefix="$"
                  />

                  <SteppedExpenseField
                    field={waterRatesField}
                    label="Water Rates (quarterly)"
                    min={0}
                    max={5000}
                    sliderMax={1000}
                    step={25}
                    color="orange"
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
                    color="orange"
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
                        color="orange"
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
                        color="orange"
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
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Number of People: {newIncomeNumPeople}</label>
                            <input
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
                          color={newIncomeIsShared ? 'blue' : 'green'}
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
                        color="green"
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
                        color="green"
                        prefix="$"
                      />
                    )}

                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                      <input
                        type="checkbox"
                        checked={newIncomeOneTime}
                        onChange={(e) => setNewIncomeOneTime(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-green-600 dark:text-green-400 focus:ring-green-500"
                      />
                      One-Time (occurs once, doesn't repeat)
                    </label>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                        {newIncomeOneTime ? `Occurs at Month: ${newIncomeStartMonth}` : `Start Month: ${newIncomeStartMonth}`}
                      </label>
                      <input
                        type="range" min="1" max={MAX_MONTH}
                        value={newIncomeStartMonth}
                        onChange={(e) => setNewIncomeStartMonth(Number(e.target.value))}
                        className="w-full h-2 bg-green-200 dark:bg-green-900 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {!newIncomeOneTime && (
                      <div className="space-y-3">
                        <div className="flex gap-2 text-xs">
                          {['monthly', 'quarterly', 'yearly'].map((option) => (
                            <button
                              key={option}
                              onClick={() => setNewIncomeRecurrence(option)}
                              className={`flex-1 py-1 rounded border capitalize text-gray-800 dark:text-gray-100 ${newIncomeRecurrence === option ? 'bg-emerald-200 dark:bg-emerald-900 border-emerald-400 dark:border-emerald-700 font-bold' : 'bg-white dark:bg-gray-800'}`}
                            >{option}</button>
                          ))}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                            End Month: {newIncomeEndMonth === MAX_MONTH ? 'Forever' : newIncomeEndMonth}
                          </label>
                          <input
                            type="range" min={newIncomeStartMonth} max={MAX_MONTH}
                            value={newIncomeEndMonth}
                            onChange={(e) => setNewIncomeEndMonth(Number(e.target.value))}
                            className="w-full h-2 bg-emerald-200 dark:bg-emerald-900 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

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
                        ${income.amount}/week {income.isShared && <span className="text-blue-600 dark:text-blue-400 font-medium">({income.numPeople} × ${income.amountPerPerson} each) </span>}• {formatScheduleLabel(income)}
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
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              {showPersonalExpenses ? '▾' : '▸'} Personal expenses breakdown (subtotal: $
              {Math.round(monthlyPersonalExpenses).toLocaleString()}/month)
            </button>

            {showPersonalExpenses && (
            <div className="space-y-4 mt-4">
              {/* OFFSET CONTRIBUTIONS SECTION */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-md font-bold text-gray-700 dark:text-gray-200">💰 Offset Contributions Schedule</h3>
                  <button
                    onClick={() => setShowAddContribution(!showAddContribution)}
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
                      prefix="$"
                      hideSlider
                    />

                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                      <input
                        type="checkbox"
                        checked={newContribOneTime}
                        onChange={(e) => setNewContribOneTime(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-cyan-600 dark:text-cyan-400 focus:ring-cyan-500"
                      />
                      One-Time (occurs once, doesn't repeat)
                    </label>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                        {newContribOneTime ? `Occurs at Month: ${newContribStartMonth}` : `Start Month: ${newContribStartMonth}`}
                      </label>
                      <input
                        type="range" min="1" max={MAX_MONTH}
                        value={newContribStartMonth}
                        onChange={(e) => setNewContribStartMonth(Number(e.target.value))}
                        className="w-full h-2 bg-cyan-200 dark:bg-cyan-900 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {!newContribOneTime && (
                      <div className="space-y-3">
                        <div className="flex gap-2 text-xs">
                          {['monthly', 'quarterly', 'yearly'].map((option) => (
                            <button
                              key={option}
                              onClick={() => setNewContribRecurrence(option)}
                              className={`flex-1 py-1 rounded border capitalize text-gray-800 dark:text-gray-100 ${newContribRecurrence === option ? 'bg-blue-200 dark:bg-blue-900 border-blue-400 dark:border-blue-700 font-bold' : 'bg-white dark:bg-gray-800'}`}
                            >{option}</button>
                          ))}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                            End Month: {newContribEndMonth === MAX_MONTH ? 'Forever' : newContribEndMonth}
                          </label>
                          <input
                            type="range" min={newContribStartMonth} max={MAX_MONTH}
                            value={newContribEndMonth}
                            onChange={(e) => setNewContribEndMonth(Number(e.target.value))}
                            className="w-full h-2 bg-blue-200 dark:bg-blue-900 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

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

              {/* PERSONAL EXPENSES (TODO-66, merged with the former "Other
                  Expenses" section in TODO-85) - an addable/removable list,
                  same Schedule model as Income Sources.
                  Groceries/Transport/Phone-Internet are just starter items here
                  (seeded in config.default.json), not fixed fields - this
                  section absorbs what used to be the separately-labeled
                  "Exceptional Expenses" and "Other Expenses" cards. */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 border-t-4 border-yellow-400 dark:border-yellow-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    <TrendingDown size={24} className="text-yellow-600 dark:text-yellow-400" />
                    Personal Expenses
                  </h2>
                  <button
                    onClick={() => setShowAddExceptExp(!showAddExceptExp)}
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
                        prefix="$"
                        hideSlider
                      />

                      <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                        <input
                          type="checkbox"
                          checked={newExpOneTime}
                          onChange={(e) => setNewExpOneTime(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-yellow-600 dark:text-yellow-400 focus:ring-yellow-500"
                        />
                        One-Time (occurs once, doesn't repeat)
                      </label>

                      <div>
                        <label className="block font-medium text-gray-700 dark:text-gray-200 mb-1">
                          {newExpOneTime ? `Occurs at Month: ${newExpStartMonth}` : `Start Month: ${newExpStartMonth}`}
                        </label>
                        <input
                          type="range" min="1" max={MAX_MONTH}
                          value={newExpStartMonth}
                          onChange={(e) => setNewExpStartMonth(Number(e.target.value))}
                          className="w-full h-2 bg-yellow-200 dark:bg-yellow-900 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {!newExpOneTime && (
                        <div className="space-y-3">
                          <div className="flex gap-2 text-xs">
                            {['monthly', 'quarterly', 'yearly'].map((option) => (
                              <button
                                key={option}
                                onClick={() => setNewExpRecurrence(option)}
                                className={`flex-1 py-1 rounded border capitalize text-gray-800 dark:text-gray-100 ${newExpRecurrence === option ? 'bg-orange-200 dark:bg-orange-900 border-orange-400 dark:border-orange-700 font-bold' : 'bg-white dark:bg-gray-800'}`}
                              >{option}</button>
                            ))}
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                              End Month: {newExpEndMonth === MAX_MONTH ? 'Forever' : newExpEndMonth}
                            </label>
                            <input
                              type="range" min={newExpStartMonth} max={MAX_MONTH}
                              value={newExpEndMonth}
                              onChange={(e) => setNewExpEndMonth(Number(e.target.value))}
                              className="w-full h-2 bg-orange-200 dark:bg-orange-900 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      )}

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
                <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-3">💵 Total Summary</h2>

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
                  valueDisplay={Number.isFinite(emergencyBufferMonths) ? `${emergencyBufferMonths.toFixed(1)} months` : '∞'}
                  classification={emergencyBufferClass}
                >
                  <p>Remaining Savings divided by your total monthly outgoings (property + personal expenses) - how many months you could cover if income stopped entirely.</p>
                  <p className="mt-2">≥12 months excellent, 6-12 good, 3-6 moderate, &lt;3 high risk - the standard "3-6 months" rule of thumb.</p>
                </HealthCheckIndicator>

                <HealthCheckIndicator
                  label="Housing Cost Ratio"
                  tooltipLabel="What is the Housing Cost Ratio?"
                  valueDisplay={`${housingCostRatio.toFixed(0)}%`}
                  classification={housingCostRatioClass}
                >
                  <p>Total property cost (loan repayment + property expenses) as a share of your total monthly income.</p>
                  <p className="mt-2">&lt;30% excellent, 30-40% good, 40-50% caution, ≥50% high risk.</p>
                </HealthCheckIndicator>

                <HealthCheckIndicator
                  label="Interest Rate Stress Test"
                  tooltipLabel="What is the Interest Rate Stress Test?"
                  valueDisplay={stressTestSurvivedDelta > 0 ? `Survives +${stressTestSurvivedDelta}%` : 'Fails at +1%'}
                  classification={stressTestClass}
                >
                  <p>Recalculates your repayment at today's rate plus 1/2/3 percentage points, and reports the largest rise your current cash flow still survives without going into deficit.</p>
                  <p className="mt-2">Survives +3% excellent, +2% good, +1% moderate, fails already at +1% high risk.</p>
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
                      classification={gearingClass}
                    >
                      <p>Rental income minus the loan repayment and property expenses. Not itself good or bad - negative gearing (a shortfall) just needs to be affordable from your other income.</p>
                    </HealthCheckIndicator>

                    <HealthCheckIndicator
                      label="Vacancy Buffer"
                      tooltipLabel="What is the Vacancy Buffer?"
                      valueDisplay={Number.isFinite(vacancyBufferMonths) ? `${vacancyBufferMonths.toFixed(1)} months` : '∞'}
                      classification={vacancyBufferClass}
                    >
                      <p>Remaining Savings divided by the loan repayment + property expenses - how many months you could cover the property alone with no tenant.</p>
                      <p className="mt-2">≥6 months excellent, 3-6 good, &lt;3 high risk.</p>
                    </HealthCheckIndicator>

                    {rentalYieldHasData ? (
                      <HealthCheckIndicator
                        label="Rental Yield"
                        tooltipLabel="What is Rental Yield?"
                        valueDisplay={`${rentalYield.toFixed(1)}%`}
                        classification={rentalYieldClass}
                      >
                        <p>Annualized rental income (House Rent/Room Rent) as a share of the property price.</p>
                        <p className="mt-2">&lt;3% weak, 3-5% average, ≥5% strong.</p>
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
              {offsetAllocationPct === 100 ? '🎯 TO OFFSET (automatic)' : '🎯 MONTHLY SURPLUS (automatic)'}
            </h2>

            <div className="text-center mb-4">
              <p className={`text-4xl font-bold ${getBalanceColor(monthlyNetBalance)}`}>
                ${Math.round(monthlyToOffset)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">per month</p>
            </div>

            {/* TODO-49: split the same total surplus by offsetAllocationPct -
                these are display-only, the actual per-month split happens
                inside offsetSimulation.js's loop against the real monthly
                figures, not this static "right now" one. */}
            {offsetAllocationPct !== 100 && (
              <div className="grid grid-cols-2 gap-3 mb-4 text-center">
                <div className="p-2 bg-white/60 dark:bg-black/20 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">To Offset ({offsetAllocationPct}%)</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                    ${Math.round(monthlyToOffset * offsetAllocationPct / 100).toLocaleString()}
                  </p>
                </div>
                <div className="p-2 bg-white/60 dark:bg-black/20 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">To Savings ({100 - offsetAllocationPct}%)</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    ${Math.round(monthlyToOffset * (100 - offsetAllocationPct) / 100).toLocaleString()}
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
              <div className="space-y-3">
                <div className="bg-white dark:bg-gray-800/20 backdrop-blur rounded-lg p-3">
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

                <div className="bg-white dark:bg-gray-800/20 backdrop-blur rounded-lg p-3">
                  <p className="text-sm opacity-90">Total interest paid:</p>
                  <p className="text-2xl font-bold">
                    ${Math.round(loanSimulation.totalInterest).toLocaleString()}
                  </p>
                </div>


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

                <div className="bg-white dark:bg-gray-800/20 backdrop-blur rounded-lg p-3 text-xs">
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

      {/* Footer Info */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
        <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
          <Calendar size={20} />
          📝 How This Calculator Works
        </h3>
        <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
          <p><strong>Flow:</strong></p>
          <ol className="list-decimal list-inside space-y-1 ml-3">
            <li>Receive your income</li>
            <li>Pay your personal expenses (food, transport, etc.)</li>
            <li>Property has costs (loan payment + strata + utilities...)</li>
            <li><strong>What's left after EVERYTHING → goes automatically to offset</strong></li>
            <li>Offset reduces your interest and accelerates loan payoff</li>
          </ol>
          <p className="mt-3 text-xs italic">
            💡 Tip: The loan calculation now includes the full offset effect. Monthly payment is always ${Math.round(monthlyPayment)}, but with offset you reduce interest and pay more principal each month, finishing the loan much sooner.
          </p>

          {/* TIMELINE EXPLORER */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Calendar size={24} className="text-purple-600 dark:text-purple-400" />
              Timeline Explorer
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
              const snapshot = getTimelineSnapshot(timelineMonth, loanSimulation.monthlyData, loanAmount, monthZeroInterest, cashRemaining);
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
                      {/* TODO-49/80: the running savings balance, seeded from
                          cashRemaining at month 0 and growing by whatever
                          share of the surplus offsetAllocationPct doesn't
                          send to the offset (flat if the allocation is 100%). */}
                      <span className="flex items-center gap-1">🐖 Savings: ${snapshot.savings.toLocaleString()}</span>
                    </div>
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
                    <p>Offset balance divided by (offset + remaining loan balance) at the month selected above - how much of what you still owe is already covered by your offset.</p>
                    <p className="mt-2">&gt;20% strong, 10-20% building, 5-10% early days, &lt;5% just started.</p>
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
                            const rentalIncomeHere = calculateMonthlyFromWeekly(getActiveAmount(incomeSources.filter(i => RENTAL_INCOME_CATEGORIES.includes(i.name)), timelineMonth));
                            const personalIncomeHere = calculateMonthlyFromWeekly(getActiveAmount(incomeSources.filter(i => !RENTAL_INCOME_CATEGORIES.includes(i.name)), timelineMonth));
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

        </div>
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
            className="font-bold text-gray-700 dark:text-gray-200 text-lg flex items-center gap-2"
          >
            {showProgressCharts ? '▾' : '▸'} 📈 Progress Over Time
          </button>
          {showProgressCharts && (
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
          )}
        </div>
      )}
    </div>
  );
};

export default PropertyInvestmentCalculator;