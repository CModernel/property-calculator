import React, { useState } from 'react';
import { DollarSign, Home, TrendingDown, Calendar, ShoppingCart, Car, RotateCcw, Wallet } from 'lucide-react';
import { formatMonthsDetailed, formatCompactMoney } from './calculations/formatting';
import NumberSliderField from './components/NumberSliderField';
import LvrBadge from './components/LvrBadge';
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
  calculateWeeklyPersonalExpenses,
  calculateMonthlyPersonalExpenses,
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
import { calculateStampDuty } from './calculations/stampDuty';
import { estimateLmi } from './calculations/lmi';
import { sumClosingCosts } from './calculations/closingCosts';
import { calculateTotalCashRequired, calculateCashRemaining } from './calculations/totalCashRequired';
import { getSteppedValue } from './calculations/steppedValue';
import { getActiveAmount, isScheduleActive, countOccurrencesUpTo, formatScheduleLabel, MAX_MONTH } from './calculations/recurringAmount';
import { INCOME_CATEGORIES, INCOME_CATEGORY_DEFAULTS } from './calculations/incomeCategories';
import { useSteppedValue } from './hooks/useSteppedValue';
import SteppedExpenseField from './components/SteppedExpenseField';
import { loadScenario, saveScenario, clearScenario } from './persistence/scenarioStorage';
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

const PropertyInvestmentCalculator = () => {
  const [propertyPrice, setPropertyPrice] = useState(config.propertyPrice);
  const [propertyType, setPropertyType] = useState(config.propertyType); // 'house' | 'unit'
  const [downPayment, setDownPayment] = useState(config.downPayment);
  const [interestRate, setInterestRate] = useState(config.interestRate);
  const [loanTermYears, setLoanTermYears] = useState(config.loanTermYears);
  const strataFeesField = useSteppedValue(config.strataFees, config.strataFeesChanges);
  const utilitiesField = useSteppedValue(config.utilities, config.utilitiesChanges);
  const councilRatesField = useSteppedValue(config.councilRates, config.councilRatesChanges);
  const insuranceField = useSteppedValue(config.insurance, config.insuranceChanges);
  const maintenanceField = useSteppedValue(config.maintenance, config.maintenanceChanges);
  const waterRatesField = useSteppedValue(config.waterRates, config.waterRatesChanges);
  const [showPropertyExpenses, setShowPropertyExpenses] = useState(false);

  // Investment-property-only expenses. Deliberately NOT wired to
  // isFirstHomeBuyer/calculateStampDuty (NSW's FHB concession really
  // requires occupying the property) - that interaction is a known,
  // documented gap (see TODO-38), not solved here.
  const [isInvestmentProperty, setIsInvestmentProperty] = useState(config.isInvestmentProperty ?? false);
  const landTaxField = useSteppedValue(config.landTax, config.landTaxChanges);
  const propertyManagementField = useSteppedValue(config.propertyManagement, config.propertyManagementChanges);

  // Upfront purchase costs (NSW)
  const [isFirstHomeBuyer, setIsFirstHomeBuyer] = useState(config.isFirstHomeBuyer);
  const [totalSavings, setTotalSavings] = useState(config.totalSavings);
  const [payLmiUpfront, setPayLmiUpfront] = useState(false);
  const [showClosingCostsBreakdown, setShowClosingCostsBreakdown] = useState(false);
  const [conveyancing, setConveyancing] = useState(config.conveyancing);
  const [buildingInspection, setBuildingInspection] = useState(config.buildingInspection);
  const [pestInspection, setPestInspection] = useState(config.pestInspection);
  const [registrationFees, setRegistrationFees] = useState(config.registrationFees);
  const [searches, setSearches] = useState(config.searches);
  const [loanEstablishmentFee, setLoanEstablishmentFee] = useState(config.loanEstablishmentFee);
  const [propertyValuation, setPropertyValuation] = useState(config.propertyValuation);
  const [homeInsurance, setHomeInsurance] = useState(config.homeInsurance);
  const [rateAdjustments, setRateAdjustments] = useState(config.rateAdjustments);

  // Income sources (salary, other income, tenants, one-time payments) - a
  // single "Schedule" shape { startMonth, recurrence: 'none'|'monthly'|
  // 'quarterly'|'yearly', endMonth }, shared with Exceptional Expenses and
  // resolved per month via getActiveAmount (src/calculations/recurringAmount.js).
  // A 'Tenants' entry additionally carries isShared/numPeople/amountPerPerson
  // (see addIncomeSource) - isShared !== undefined is how a Tenants entry is
  // told apart from any other income category elsewhere in the file.
  const [incomeSources, setIncomeSources] = useState(config.incomeSources ?? []);
  const [showIncome, setShowIncome] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [newIncomeCategory, setNewIncomeCategory] = useState('Salary/Wages'); // see INCOME_CATEGORIES (src/calculations/incomeCategories.js)
  const [newIncomeCustomName, setNewIncomeCustomName] = useState(''); // only used when category is 'Other'
  const [newIncomeAmount, setNewIncomeAmount] = useState(config.newIncomeAmount);
  const [newIncomeIsShared, setNewIncomeIsShared] = useState(false); // only used when category is 'Tenants'
  const [newIncomeNumPeople, setNewIncomeNumPeople] = useState(2); // only used when category is 'Tenants' and shared
  const [newIncomeOneTime, setNewIncomeOneTime] = useState(false);
  const [newIncomeStartMonth, setNewIncomeStartMonth] = useState(1);
  const [newIncomeRecurrence, setNewIncomeRecurrence] = useState('monthly'); // monthly | quarterly | yearly
  const [newIncomeEndMonth, setNewIncomeEndMonth] = useState(MAX_MONTH);

  // Your personal expenses
  const foodExpensesField = useSteppedValue(config.foodExpenses, config.foodExpensesChanges);
  const transportExpensesField = useSteppedValue(config.transportExpenses, config.transportExpensesChanges);
  const otherExpensesField = useSteppedValue(config.otherExpenses, config.otherExpensesChanges);
  const [showPersonalExpenses, setShowPersonalExpenses] = useState(false);

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

  // Exceptional Expenses State
  const [exceptExpenses, setExceptExpenses] = useState(config.exceptExpenses ?? []);
  const [showAddExceptExp, setShowAddExceptExp] = useState(false);
  const [newExpName, setNewExpName] = useState('Rent');
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
  const monthlyRate = calculateMonthlyRate(interestRate);
  const totalMonths = loanTermYears * 12;
  const monthlyPayment = calculateMonthlyPayment(loanAmount, monthlyRate, totalMonths);

  // Upfront costs of buying (NSW)
  const stampDuty = calculateStampDuty(propertyPrice, isFirstHomeBuyer);
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
  ]);
  const totalCashRequired = calculateTotalCashRequired({
    downPayment,
    stampDuty,
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
  const foodExpenses = getSteppedValue(foodExpensesField.base, foodExpensesField.changes, 1);
  const transportExpenses = getSteppedValue(transportExpensesField.base, transportExpensesField.changes, 1);
  const otherExpenses = getSteppedValue(otherExpensesField.base, otherExpensesField.changes, 1);

  // Monthly property expenses
  const monthlyStrata = calculateMonthlyStrata(strataFees);
  const monthlyCouncil = calculateMonthlyCouncil(councilRates);
  const monthlyWaterRates = calculateMonthlyWaterRates(waterRates);
  const monthlyLandTax = calculateMonthlyLandTax(landTax);
  const monthlyPropertyExpenses = calculateMonthlyPropertyExpenses({
    monthlyStrata, utilities, monthlyCouncil, insurance,
    maintenance, monthlyWaterRates, monthlyLandTax, propertyManagement,
  });
  const totalPropertyCost = calculateTotalPropertyCost(monthlyPayment, monthlyPropertyExpenses);

  // Interest on the full balance, before any offset is applied.
  // This is the Timeline Explorer's "month 0" figure: nothing has happened yet,
  // so it must stay consistent with that snapshot's offset: 0 / effectiveBalance: loanAmount.
  const monthZeroInterest = calculateInitialMonthlyInterest(loanAmount, monthlyRate);

  // Your personal expenses
  const weeklyPersonalExpenses = calculateWeeklyPersonalExpenses(foodExpenses, transportExpenses, otherExpenses);
  const monthlyPersonalExpenses = calculateMonthlyPersonalExpenses(weeklyPersonalExpenses);

  // Total cash flow. Same "right now" (month 1) convention as exceptional
  // expenses - an income source that hasn't started yet, or already ended,
  // shouldn't count here. Tenants (isShared !== undefined) live inside
  // incomeSources like any other entry - this just partitions the same
  // array into the two subtotals the rest of the app already expects,
  // instead of drawing from two separate arrays.
  const weeklyIncome = getActiveAmount(incomeSources.filter(i => i.isShared === undefined), 1);
  const weeklyRentalIncome = getActiveAmount(incomeSources.filter(i => i.isShared !== undefined), 1);
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
    foodExpenses: foodExpensesField,
    transportExpenses: transportExpensesField,
    otherExpenses: otherExpensesField,
  };

  // Complete loan simulation with offset. maxMonths must match the chosen
  // term explicitly - otherwise the loop would keep the old 30-year cap
  // baked into offsetSimulation.js's default, inconsistent with a shorter
  // term's monthlyPayment.
  const loanSimulation = calculateLoanWithOffset({
    contributions: offsetContributions,
    exceptExpenses,
    incomeSources,
    expenseFields,
    monthlyToOffset: baseMonthlySurplus,
    loanAmount,
    monthlyRate,
    monthlyPayment,
    maxMonths: totalMonths,
  });
  const baselineSimulation = calculateLoanWithOffset({
    contributions: [], // No offsets
    exceptExpenses,
    incomeSources,
    expenseFields,
    monthlyToOffset: baseMonthlySurplus,
    loanAmount,
    monthlyRate,
    monthlyPayment,
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
  const handleInvestmentPropertyChange = (checked) => {
    setIsInvestmentProperty(checked);
    if (checked) {
      if (landTaxField.base === 0) landTaxField.setBase(2000);
      if (propertyManagementField.base === 0) propertyManagementField.setBase(150);
    }
  };

  // Only the ~24 "data" inputs are saved - ephemeral UI state (collapsed
  // sections, in-progress "Add" form drafts, the Timeline Explorer's
  // selected month) isn't part of a scenario.
  const handleSaveScenario = () => {
    const savedAt = Date.now();
    const scenario = {
      propertyPrice, propertyType, downPayment, interestRate, loanTermYears,
      strataFees: strataFeesField.base, strataFeesChanges: strataFeesField.changes,
      utilities: utilitiesField.base, utilitiesChanges: utilitiesField.changes,
      councilRates: councilRatesField.base, councilRatesChanges: councilRatesField.changes,
      insurance: insuranceField.base, insuranceChanges: insuranceField.changes,
      maintenance: maintenanceField.base, maintenanceChanges: maintenanceField.changes,
      waterRates: waterRatesField.base, waterRatesChanges: waterRatesField.changes,
      isInvestmentProperty,
      landTax: landTaxField.base, landTaxChanges: landTaxField.changes,
      propertyManagement: propertyManagementField.base, propertyManagementChanges: propertyManagementField.changes,
      isFirstHomeBuyer, totalSavings, payLmiUpfront,
      conveyancing, buildingInspection, pestInspection, registrationFees, searches,
      loanEstablishmentFee, propertyValuation, homeInsurance, rateAdjustments,
      incomeSources,
      foodExpenses: foodExpensesField.base, foodExpensesChanges: foodExpensesField.changes,
      transportExpenses: transportExpensesField.base, transportExpensesChanges: transportExpensesField.changes,
      otherExpenses: otherExpensesField.base, otherExpensesChanges: otherExpensesField.changes,
      offsetContributions,
      exceptExpenses,
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
    if (newContribAmount <= 0) return;
    if (!newContribOneTime && newContribStartMonth > newContribEndMonth) {
      alert('Start month must be before end month.');
      return;
    }

    // Only guards against two one-time lump sums landing on the exact same
    // month - two independent recurring contributions starting on the same
    // month aren't a conflict the way two one-time lumps in the same month are.
    if (newContribOneTime) {
      const monthExists = offsetContributions.some(c => c.recurrence === 'none' && c.startMonth === newContribStartMonth);
      if (monthExists) {
        alert('A contribution already exists for this month. Please remove it first or choose a different month.');
        return;
      }
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
  // Tenants' own Shared Room fields (isShared/numPeople) are untouched, and
  // categories without a listed default (Tenants, Other) keep whatever the
  // form's current Schedule fields already are.
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
    const isTenants = newIncomeCategory === 'Tenants';
    const name = newIncomeCategory === 'Other' ? newIncomeCustomName : newIncomeCategory;
    if (!name) {
      alert('Please enter a name for the income source.');
      return;
    }
    if (newIncomeAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    if (!newIncomeOneTime && newIncomeStartMonth > newIncomeEndMonth) {
      alert('Start month must be before end month.');
      return;
    }

    const numPeople = isTenants && newIncomeIsShared ? newIncomeNumPeople : 1;
    const newIncome = {
      id: Date.now(),
      name,
      // For Tenants, amount is the computed total (amountPerPerson * numPeople) -
      // getActiveAmount/calculateMonthlyFromWeekly only ever read `amount`, so
      // they don't need to know about the per-person split.
      amount: isTenants ? newIncomeAmount * numPeople : newIncomeAmount,
      startMonth: newIncomeStartMonth,
      recurrence: newIncomeOneTime ? 'none' : newIncomeRecurrence,
      ...(newIncomeOneTime ? {} : { endMonth: newIncomeEndMonth }),
      ...(isTenants ? { isShared: newIncomeIsShared, numPeople, amountPerPerson: newIncomeAmount } : {}),
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

  // Exceptional Expenses Functions
  const addExceptionalExpense = () => {
    if (!newExpName) {
      alert('Please enter a name for the expense.');
      return;
    }
    if (newExpAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    if (!newExpOneTime && newExpStartMonth > newExpEndMonth) {
      alert('Start month must be before end month.');
      return;
    }

    const newExp = {
      id: Date.now(),
      name: newExpName,
      amount: newExpAmount,
      startMonth: newExpStartMonth,
      recurrence: newExpOneTime ? 'none' : newExpRecurrence,
      ...(newExpOneTime ? {} : { endMonth: newExpEndMonth }),
    };

    setExceptExpenses([...exceptExpenses, newExp]);
    setShowAddExceptExp(false);
    setNewExpName('Rent');
    setNewExpAmount(920);
    setNewExpOneTime(false);
    setNewExpStartMonth(1);
    setNewExpRecurrence('monthly');
    setNewExpEndMonth(MAX_MONTH);
  };

  const removeExceptionalExpense = (id) => {
    setExceptExpenses(exceptExpenses.filter(e => e.id !== id));
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="bg-white rounded-xl shadow-xl p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
          <Home className="text-blue-600" size={36} />
          NSW Property Investment Cash Flow Calculator
        </h1>
        <p className="text-gray-600">How much is left after EVERYTHING? That goes to offset automatically.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-amber-800">
          ⚠️ Personal project for illustrative purposes only — not financial advice. Always consult a licensed
          financial adviser before making property decisions.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 mb-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-600">
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
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
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
          <div className="bg-white rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Home size={24} className="text-blue-600" />
              Purchase Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handlePropertyTypeChange('house')}
                    className={`flex-1 py-1.5 px-2 rounded text-sm ${propertyType === 'house' ? 'bg-blue-600 text-white' : 'bg-blue-200 text-blue-800'
                      }`}
                  >
                    House
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePropertyTypeChange('unit')}
                    className={`flex-1 py-1.5 px-2 rounded text-sm ${propertyType === 'unit' ? 'bg-blue-600 text-white' : 'bg-blue-200 text-blue-800'
                      }`}
                  >
                    Unit / Apartment
                  </button>
                </div>
                {propertyType === 'house' && (
                  <p className="text-xs text-gray-500 mt-1">No strata - houses aren't on a shared title.</p>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={isFirstHomeBuyer}
                  onChange={(e) => setIsFirstHomeBuyer(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                First Home Buyer (NSW stamp duty concession)
              </label>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={isInvestmentProperty}
                    onChange={(e) => handleInvestmentPropertyChange(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Investment Property
                </label>
                {isInvestmentProperty && (
                  <p className="text-xs text-gray-500 mt-1">Adds Land Tax and Property Management to Property Expenses.</p>
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
          <div className="bg-white rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Wallet size={24} className="text-blue-600" />
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

              {/* min must stay above 0: a 0% rate makes calculateMonthlyPayment
                  divide 0 by 0, turning every figure on the page into NaN. */}
              <NumberSliderField
                label="Interest Rate"
                value={interestRate}
                onChange={setInterestRate}
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

              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-gray-700">
                  Repayments: ${Math.round(monthlyPayment).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Upfront Costs (NSW) */}
          <div className="bg-white rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
              <DollarSign size={24} className="text-purple-600" />
              Upfront Costs (NSW)
            </h2>

            <div className="space-y-4">
              {lvr > 80 && (
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={payLmiUpfront}
                    onChange={(e) => setPayLmiUpfront(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Pay LMI upfront in cash (instead of financing it into the loan)
                </label>
              )}

              <button
                type="button"
                onClick={() => setShowClosingCostsBreakdown(!showClosingCostsBreakdown)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                {showClosingCostsBreakdown ? '▾' : '▸'} Closing costs breakdown (subtotal: ${closingCostsSubtotal.toLocaleString()})
              </button>

              {showClosingCostsBreakdown && (
                <div className="space-y-4 pl-3 border-l-2 border-gray-200">
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
                </div>
              )}
            </div>
          </div>

          {/* Property Expenses */}
          <div className="bg-white rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
              <DollarSign size={24} className="text-orange-600" />
              Property Expenses
            </h2>

            <button
              type="button"
              onClick={() => setShowPropertyExpenses(!showPropertyExpenses)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
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
                </div>

                {isInvestmentProperty && (
                  <div className="border-t border-orange-200 pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Investment Property</p>
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
          <div className="bg-white rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
              <DollarSign size={24} className="text-green-600" />
              Income
            </h2>

            <button
              type="button"
              onClick={() => setShowIncome(!showIncome)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {showIncome ? '▾' : '▸'} Income breakdown (subtotal: ${weeklyIncome.toLocaleString()}/week)
            </button>

            {showIncome && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-md font-bold text-gray-700">💵 Income Sources</h3>
                <button
                  onClick={() => setShowAddIncome(!showAddIncome)}
                  className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors"
                >
                  {showAddIncome ? '✕ Cancel' : '+ Add'}
                </button>
              </div>

              {/* Add income form */}
              {showAddIncome && (
                <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-200 text-sm">
                  <div className="grid gap-3">
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">Income Name</label>
                      <select
                        value={newIncomeCategory}
                        onChange={(e) => handleIncomeCategoryChange(e.target.value)}
                        className="w-full p-2 border rounded"
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
                          className="w-full p-2 border rounded mt-2"
                          placeholder="e.g. Dividends, Side Business"
                        />
                      )}
                    </div>

                    {newIncomeCategory === 'Tenants' ? (
                      <>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={newIncomeIsShared}
                            onChange={(e) => setNewIncomeIsShared(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          Shared room? (multiple people splitting this room)
                        </label>

                        {newIncomeIsShared && (
                          <div>
                            <label className="block text-xs font-medium mb-1">Number of People: {newIncomeNumPeople}</label>
                            <input
                              type="range" min="2" max="6"
                              value={newIncomeNumPeople}
                              onChange={(e) => setNewIncomeNumPeople(Number(e.target.value))}
                              className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
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

                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={newIncomeOneTime}
                        onChange={(e) => setNewIncomeOneTime(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      One-Time (occurs once, doesn't repeat)
                    </label>

                    <div>
                      <label className="block text-xs font-medium mb-1">
                        {newIncomeOneTime ? `Occurs at Month: ${newIncomeStartMonth}` : `Start Month: ${newIncomeStartMonth}`}
                      </label>
                      <input
                        type="range" min="1" max={MAX_MONTH}
                        value={newIncomeStartMonth}
                        onChange={(e) => setNewIncomeStartMonth(Number(e.target.value))}
                        className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {!newIncomeOneTime && (
                      <div className="space-y-3">
                        <div className="flex gap-2 text-xs">
                          {['monthly', 'quarterly', 'yearly'].map((option) => (
                            <button
                              key={option}
                              onClick={() => setNewIncomeRecurrence(option)}
                              className={`flex-1 py-1 rounded border capitalize ${newIncomeRecurrence === option ? 'bg-emerald-200 border-emerald-400 font-bold' : 'bg-white'}`}
                            >{option}</button>
                          ))}
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1">
                            End Month: {newIncomeEndMonth === MAX_MONTH ? 'Forever' : newIncomeEndMonth}
                          </label>
                          <input
                            type="range" min={newIncomeStartMonth} max={MAX_MONTH}
                            value={newIncomeEndMonth}
                            onChange={(e) => setNewIncomeEndMonth(Number(e.target.value))}
                            className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer"
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
                  <p className="text-sm text-gray-500 italic text-center">No income sources added.</p>
                )}
                {incomeSources.map(income => (
                  <div key={income.id} className={`flex justify-between items-center p-2 rounded text-sm border ${income.isShared ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}`}>
                    <div>
                      <p className="font-bold text-gray-800">
                        {income.isShared !== undefined ? (income.isShared ? 'Shared Room' : 'Individual Room') : income.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        ${income.amount}/week {income.isShared && <span className="text-blue-600 font-medium">({income.numPeople} × ${income.amountPerPerson} each) </span>}• {formatScheduleLabel(income)}
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
          <div className="bg-white rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
              <ShoppingCart size={24} className="text-purple-600" />
              Your Personal Expenses (Weekly)
            </h2>

            <button
              type="button"
              onClick={() => setShowPersonalExpenses(!showPersonalExpenses)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {showPersonalExpenses ? '▾' : '▸'} Personal expenses breakdown (subtotal: $
              {Math.round(weeklyPersonalExpenses).toLocaleString()}/week)
            </button>

            {showPersonalExpenses && (
            <div className="space-y-4 mt-4">
              {/* OFFSET CONTRIBUTIONS SECTION */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-md font-bold text-gray-700">💰 Offset Contributions Schedule</h3>
                  <button
                    onClick={() => setShowAddContribution(!showAddContribution)}
                    className="px-3 py-1 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600 transition-colors"
                  >
                    {showAddContribution ? '✕ Cancel' : '+ Add'}
                  </button>
                </div>

                {/* Add contribution form */}
                {showAddContribution && (
                  <div className="mb-3 p-3 bg-cyan-50 rounded-lg border border-cyan-200 space-y-3">
                    <NumberSliderField
                      label="Amount ($)"
                      value={newContribAmount}
                      onChange={setNewContribAmount}
                      min={0}
                      max={500000}
                      prefix="$"
                      hideSlider
                    />

                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={newContribOneTime}
                        onChange={(e) => setNewContribOneTime(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      One-Time (occurs once, doesn't repeat)
                    </label>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {newContribOneTime ? `Occurs at Month: ${newContribStartMonth}` : `Start Month: ${newContribStartMonth}`}
                      </label>
                      <input
                        type="range" min="1" max={MAX_MONTH}
                        value={newContribStartMonth}
                        onChange={(e) => setNewContribStartMonth(Number(e.target.value))}
                        className="w-full h-2 bg-cyan-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {!newContribOneTime && (
                      <div className="space-y-3">
                        <div className="flex gap-2 text-xs">
                          {['monthly', 'quarterly', 'yearly'].map((option) => (
                            <button
                              key={option}
                              onClick={() => setNewContribRecurrence(option)}
                              className={`flex-1 py-1 rounded border capitalize ${newContribRecurrence === option ? 'bg-blue-200 border-blue-400 font-bold' : 'bg-white'}`}
                            >{option}</button>
                          ))}
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1">
                            End Month: {newContribEndMonth === MAX_MONTH ? 'Forever' : newContribEndMonth}
                          </label>
                          <input
                            type="range" min={newContribStartMonth} max={MAX_MONTH}
                            value={newContribEndMonth}
                            onChange={(e) => setNewContribEndMonth(Number(e.target.value))}
                            className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
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
                      className="flex items-center justify-between p-3 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🔵</span>
                          <div>
                            <p className="font-semibold text-gray-800">
                              {formatScheduleLabel(contrib)}
                            </p>
                            <p className="text-xs text-gray-600">
                              {contrib.recurrence === 'none'
                                ? formatMonthsDetailed(contrib.startMonth).human
                                : `Starts in ${formatMonthsDetailed(contrib.startMonth).human}`}
                            </p>
                          </div>
                        </div>
                        <p className="text-lg font-bold text-cyan-700 mt-1 ml-7">
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
                <div className="mt-3 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                  <p className="text-sm font-semibold text-gray-700">
                    📊 One-Time Contributions Total: <span className="text-indigo-700 text-lg">${totalScheduledOffset.toLocaleString()}</span>
                  </p>
                  {recurringContributionsCount > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Plus {recurringContributionsCount} recurring contribution{recurringContributionsCount !== 1 ? 's' : ''} - applied
                      automatically each month it's active, not counted in this total or in Cash Remaining below.
                    </p>
                  )}
                  {totalScheduledOffset > 0 && (
                    <div className="mt-1 space-y-1">
                      {/* "% of loan balance" reads as nonsense with no loan, so drop the line entirely. */}
                      {loanAmount > 0 && (
                        <p className="text-xs text-gray-600">
                          Reduces {safePercentage(totalScheduledOffset, loanAmount).toFixed(1)}% of loan balance
                        </p>
                      )}
                      <p className="text-xs font-semibold text-green-700">
                        ~${Math.round(interestSaved).toLocaleString()} saved in interest
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <SteppedExpenseField
                    field={foodExpensesField}
                    label="Food"
                    min={0}
                    max={5000}
                    sliderMax={600}
                    step={10}
                    color="purple"
                    prefix="$"
                  />

                  <SteppedExpenseField
                    field={transportExpensesField}
                    label="Transport"
                    min={0}
                    max={5000}
                    sliderMax={400}
                    step={10}
                    color="purple"
                    prefix="$"
                  />

                  <SteppedExpenseField
                    field={otherExpensesField}
                    label="Other"
                    min={0}
                    max={10000}
                    sliderMax={800}
                    step={10}
                    color="purple"
                    prefix="$"
                  />
              </div>

              {/* EXCEPTIONAL EXPENSES */}
              <div className="bg-white rounded-lg shadow-md p-5 border-t-4 border-yellow-400">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                    <TrendingDown size={24} className="text-yellow-600" />
                    Exceptional Expenses
                  </h2>
                  <button
                    onClick={() => setShowAddExceptExp(!showAddExceptExp)}
                    className="px-3 py-1 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600 transition-colors"
                  >
                    {showAddExceptExp ? '✕ Cancel' : '+ Add'}
                  </button>
                </div>

                {showAddExceptExp && (
                  <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-sm">
                    <div className="grid gap-3">
                      <div>
                        <label className="block font-medium text-gray-700 mb-1">Expense Name</label>
                        <input
                          type="text"
                          value={newExpName}
                          onChange={(e) => setNewExpName(e.target.value)}
                          className="w-full p-2 border rounded"
                          placeholder="e.g. Wedding, Car Repair"
                        />
                      </div>

                      <NumberSliderField
                        label="Amount ($)"
                        value={newExpAmount}
                        onChange={setNewExpAmount}
                        min={0}
                        max={500000}
                        prefix="$"
                        hideSlider
                      />

                      <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                        <input
                          type="checkbox"
                          checked={newExpOneTime}
                          onChange={(e) => setNewExpOneTime(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                        />
                        One-Time (occurs once, doesn't repeat)
                      </label>

                      <div>
                        <label className="block font-medium text-gray-700 mb-1">
                          {newExpOneTime ? `Occurs at Month: ${newExpStartMonth}` : `Start Month: ${newExpStartMonth}`}
                        </label>
                        <input
                          type="range" min="1" max={MAX_MONTH}
                          value={newExpStartMonth}
                          onChange={(e) => setNewExpStartMonth(Number(e.target.value))}
                          className="w-full h-2 bg-yellow-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {!newExpOneTime && (
                        <div className="space-y-3">
                          <div className="flex gap-2 text-xs">
                            {['monthly', 'quarterly', 'yearly'].map((option) => (
                              <button
                                key={option}
                                onClick={() => setNewExpRecurrence(option)}
                                className={`flex-1 py-1 rounded border capitalize ${newExpRecurrence === option ? 'bg-orange-200 border-orange-400 font-bold' : 'bg-white'}`}
                              >{option}</button>
                            ))}
                          </div>

                          <div>
                            <label className="block text-xs font-medium mb-1">
                              End Month: {newExpEndMonth === MAX_MONTH ? 'Forever' : newExpEndMonth}
                            </label>
                            <input
                              type="range" min={newExpStartMonth} max={MAX_MONTH}
                              value={newExpEndMonth}
                              onChange={(e) => setNewExpEndMonth(Number(e.target.value))}
                              className="w-full h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      )}

                      <button
                        onClick={addExceptionalExpense}
                        className="w-full py-2 bg-yellow-600 text-white rounded font-bold hover:bg-yellow-700"
                      >
                        Add Expense
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {exceptExpenses.length === 0 && !showAddExceptExp && (
                    <p className="text-sm text-gray-500 italic text-center">No exceptional expenses added.</p>
                  )}
                  {exceptExpenses.map(exp => (
                    <div key={exp.id} className="flex justify-between items-center p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                      <div>
                        <p className="font-bold text-gray-800">{exp.name}</p>
                        <p className="text-xs text-gray-600">
                          ${exp.amount} • {formatScheduleLabel(exp)}
                        </p>
                      </div>
                      <button onClick={() => removeExceptionalExpense(exp.id)} className="text-red-500 font-bold px-2">✕</button>
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
          <div className="bg-white rounded-lg shadow-md p-5">
            <h2 className="text-lg font-bold text-gray-700 mb-3">🏠 Property Balance</h2>
            <div className="space-y-4 text-sm"> {/* Increased spacing between sections */}

              {/* Loan details section */}
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <h3 className="font-semibold text-gray-700 mb-2">🏠 Loan Information</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Repayments:</span>
                    <span className="text-gray-700 font-medium">${Math.round(monthlyPayment).toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Interest Amount (monthly):</span>
                    <span className="text-orange-600">-${firstMonthInterest.toLocaleString()}</span>
                    {firstMonthOffset > 0 && <span className="text-xs text-green-600 ml-1 self-center">(offset applied)</span>}
                  </div>
                </div>
              </div>

              {/* Monthly expenses section */}
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                <h3 className="font-semibold text-gray-700 mb-2">💳 Monthly Expenses</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Loan Payment (monthly):</span>
                    <span className="font-semibold text-red-600">-${Math.round(monthlyPayment).toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Strata (monthly):</span>
                    <span className="font-semibold text-red-600">-${Math.round(monthlyStrata).toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Council (monthly):</span>
                    <span className="font-semibold text-red-600">-${Math.round(monthlyCouncil).toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Utilities (monthly):</span>
                    <span className="font-semibold text-red-600">-${utilities.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Insurance (monthly):</span>
                    <span className="font-semibold text-red-600">-${insurance.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Maintenance & Repairs (monthly):</span>
                    <span className="font-semibold text-red-600">-${maintenance.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Water Rates (monthly):</span>
                    <span className="font-semibold text-red-600">-${Math.round(monthlyWaterRates).toLocaleString()}</span>
                  </div>

                  {isInvestmentProperty && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Land Tax (monthly):</span>
                        <span className="font-semibold text-red-600">-${Math.round(monthlyLandTax).toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-gray-600">Property Management (monthly):</span>
                        <span className="font-semibold text-red-600">-${propertyManagement.toLocaleString()}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between">
                    <span className="text-gray-600">Personal Expenses:</span>
                    <span className="font-semibold text-red-600">-${Math.round(monthlyPersonalExpenses).toLocaleString()}</span>
                  </div>

                  <div className="border-t border-orange-200 pt-1 mt-1 font-bold">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Total Monthly Expenses:</span>
                      <span className="text-red-700">-${Math.round(totalPropertyCost + monthlyPersonalExpenses).toLocaleString()}/month</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Income section */}
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <h3 className="font-semibold text-gray-700 mb-2">💰 Monthly Income</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monthly Rental Income:</span>
                    <span className="font-semibold text-green-600">+${Math.round(monthlyRentalIncome).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Personal Income:</span>
                    <span className="font-semibold text-green-600">+${Math.round(monthlyIncome).toLocaleString()}</span>
                  </div>
                  <div className="border-t border-green-200 pt-1 mt-1 font-bold">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Total Monthly Income:</span>
                      <span className="text-green-700">+${Math.round(monthlyRentalIncome + monthlyIncome).toLocaleString()}/month</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upfront Costs section */}
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <h3 className="font-semibold text-gray-700 mb-2">🏛️ Upfront Costs (NSW)</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      Stamp Duty{isFirstHomeBuyer && ' (FHB concession)'}:
                    </span>
                    <span className="font-semibold text-red-600">-${Math.round(stampDuty).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      LMI (estimate, {lvr.toFixed(1)}% LVR):
                      <LvrBadge lvr={lvr} />
                    </span>
                    <span className="font-semibold text-red-600">
                      {lmi > 0 ? `-$${Math.round(lmi).toLocaleString()}` : '$0'}
                      {lmi > 0 && !payLmiUpfront && (
                        <span className="text-xs text-gray-500 font-normal ml-1">(financed into loan)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Closing Costs:</span>
                    <span className="font-semibold text-red-600">-${closingCostsSubtotal.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-purple-200 pt-1 mt-1 font-bold">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Total Cash Required:</span>
                      <span className="text-red-700">${Math.round(totalCashRequired).toLocaleString()}</span>
                    </div>
                  </div>
                  {totalScheduledOffset > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">One-Time Offset Contributions:</span>
                      <span className="font-semibold text-red-600">-${totalScheduledOffset.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Available Savings:</span>
                    <span className="font-semibold text-gray-700">${totalSavings.toLocaleString()}</span>
                  </div>
                  <div className={`border-t pt-1 mt-1 font-bold ${getBalanceBgColor(cashRemaining)}`}>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Remaining Savings:</span>
                      <span className={getBalanceColor(cashRemaining)}>
                        {cashRemaining >= 0 ? '+' : '-'}${Math.abs(Math.round(cashRemaining)).toLocaleString()}
                      </span>
                    </div>
                    {cashRemaining < 0 && (
                      <p className="mt-2 p-2 bg-red-50 border border-red-300 rounded text-xs text-red-700 font-normal">
                        ⚠️ You've committed ${Math.abs(Math.round(cashRemaining)).toLocaleString()} more than your
                        savings cover (deposit + upfront costs + scheduled contributions).
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Property Summary section */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <h3 className="font-semibold text-gray-700 mb-2">📊 Property Summary</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Property Monthly Expenses:</span>
                    <span className="font-semibold text-red-600">-${Math.round(totalPropertyCost).toLocaleString()}/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Property Monthly Income:</span>
                    <span className="font-semibold text-green-600">+${Math.round(monthlyRentalIncome).toLocaleString()}/month</span>
                  </div>
                  <div className="border-t border-gray-300 pt-1 mt-1 font-bold">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Net Property Monthly Balance:</span>
                      <span className={(monthlyRentalIncome - totalPropertyCost) >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {(monthlyRentalIncome - totalPropertyCost) >= 0 ? '+' : '-'}${Math.abs(Math.round(monthlyRentalIncome - totalPropertyCost)).toLocaleString()}/month
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Summary section */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 mt-4">
                <h2 className="text-lg font-bold text-gray-700 mb-3">💵 Total Summary</h2>

                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-16 h-16 rounded-full shadow-inner" style={{
                    background: `conic-gradient(#ef4444 ${expenseRatio}%, #22c55e 0)`
                  }}>
                    <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-500">
                        {Math.round(expenseRatio)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full"></div> Income</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full"></div> Expenses</div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Monthly Expenses:</span>
                    <span className="font-semibold text-red-600">-${Math.round(totalPropertyCost + monthlyPersonalExpenses).toLocaleString()}/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Monthly Income:</span>
                    <span className="font-semibold text-green-600">+${Math.round(monthlyRentalIncome + monthlyIncome).toLocaleString()}/month</span>
                  </div>
                  <div className="border-t border-slate-300 pt-1 mt-1 font-bold">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Net Monthly Balance:</span>
                      <span className={(monthlyRentalIncome + monthlyIncome) - (totalPropertyCost + monthlyPersonalExpenses) >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {(monthlyRentalIncome + monthlyIncome) - (totalPropertyCost + monthlyPersonalExpenses) >= 0 ? '+' : ''}
                        ${Math.round((monthlyRentalIncome + monthlyIncome) - (totalPropertyCost + monthlyPersonalExpenses)).toLocaleString()}/month
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status message */}
              <p className={`text-center text-xs px-2 py-1 rounded ${(monthlyRentalIncome + monthlyIncome) >= (totalPropertyCost + monthlyPersonalExpenses) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {(monthlyRentalIncome + monthlyIncome) >= (totalPropertyCost + monthlyPersonalExpenses)
                  ? `✅ Income covers all expenses. (+$${Math.round((monthlyRentalIncome + monthlyIncome) - (totalPropertyCost + monthlyPersonalExpenses)).toLocaleString()})`
                  : `❌ Need $${Math.round((totalPropertyCost + monthlyPersonalExpenses) - (monthlyRentalIncome + monthlyIncome))}/month extra`
                }
              </p>
            </div>
          </div>



          {/* WHAT GOES TO OFFSET */}
          <div className={`rounded-lg shadow-lg p-6 border-2 ${getBalanceBgColor(monthlyNetBalance)}`}>
            <h2 className="text-lg font-bold text-gray-700 mb-3 text-center">
              🎯 TO OFFSET (automatic)
            </h2>

            <div className="text-center mb-4">
              <p className={`text-4xl font-bold ${getBalanceColor(monthlyNetBalance)}`}>
                ${Math.round(monthlyToOffset)}
              </p>
              <p className="text-sm text-gray-600">per month</p>
            </div>

            <div className="space-y-2 text-sm border-t pt-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Per week:</span>
                <span className="font-semibold">${Math.round(weeklyToOffset)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Per fortnight:</span>
                <span className="font-semibold">${Math.round(fortnightlyToOffset)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Per year:</span>
                <span className="font-semibold text-green-700">${Math.round(monthlyToOffset * 12).toLocaleString()}</span>
              </div>
            </div>

            {monthlyNetBalance < 0 && (
              <div className="mt-4 p-3 bg-red-100 rounded text-red-800 text-xs">
                ⚠️ You're in deficit. Cannot sustain this without extra savings.
              </div>
            )}

            {monthlyNetBalance >= 0 && monthlyNetBalance < 300 && (
              <div className="mt-4 p-3 bg-yellow-100 rounded text-yellow-800 text-xs">
                ⚠️ Tight margin. Little buffer for emergencies.
              </div>
            )}

            {monthlyNetBalance >= 300 && (
              <div className="mt-4 p-3 bg-green-100 rounded text-green-800 text-xs">
                ✅ Excellent! Good margin and fast loan payoff.
              </div>
            )}
          </div>

          {/* Estimated time */}
          {(monthlyToOffset > 0 || totalScheduledOffset > 0) && (
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-5 shadow-lg text-white">
              <h3 className="font-bold mb-3 text-lg">⏱️ Loan Simulation</h3>
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

      {/* Footer Info */}
      <div className="mt-6 bg-white rounded-lg shadow-md p-5">
        <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
          <Calendar size={20} />
          📝 How This Calculator Works
        </h3>
        <div className="text-sm text-gray-600 space-y-2">
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
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Calendar size={24} className="text-purple-600" />
              Timeline Explorer
            </h2>

            {/* No month-by-month data means there is nothing to scrub through:
                either there is no loan, or no surplus and no contributions. */}
            {loanSimulation.monthlyData.length === 0 ? (
              <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-4">
                {loanAmount <= 0
                  ? 'No loan to simulate — the deposit covers the full purchase price.'
                  : 'Nothing going into the offset yet, so there is no timeline to explore. Add income, reduce expenses, or schedule a contribution.'}
              </p>
            ) : (
            <>
            <div className="mb-6">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <span className="text-sm font-semibold text-gray-500 uppercase">Viewing Month</span>
                  <p className="text-3xl font-bold text-purple-700">{timelineMonth}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-600">
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
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Start</span>
                <span>Middle ({Math.round(loanSimulation.months / 2)})</span>
                <span>End ({loanSimulation.months})</span>
              </div>
            </div>

            {(() => {
              // Get data for selected month (handle month 0 case)
              const snapshot = timelineMonth === 0
                ? {
                  balance: loanAmount,
                  offset: 0,
                  effectiveBalance: loanAmount,
                  monthlyInterestPaid: Math.round(monthZeroInterest),
                  totalInterestPaid: 0,
                  totalPrincipalPaid: 0
                }
                : (loanSimulation.monthlyData.find(d => d.month === timelineMonth) || loanSimulation.monthlyData[loanSimulation.monthlyData.length - 1]);

              if (!snapshot) return null;

              // No loan at all means the property is owned outright, so the bar is full.
              const effectiveProgress = Math.min(
                100,
                safePercentage(loanAmount - snapshot.effectiveBalance, loanAmount, 100)
              );
              const monthsRemaining = loanSimulation.months - timelineMonth;
              const yearsRem = Math.floor(Math.max(0, monthsRemaining) / 12);
              const monthsRem = Math.max(0, monthsRemaining) % 12;

              return (
                <div className="space-y-6">
                  {/* PRIMARY STAT: NET EFFECTIVE BALANCE */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200 text-center shadow-sm">
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Net Effective Balance</p>
                    <p className="text-4xl font-extrabold text-blue-900 mb-2">
                      ${snapshot.effectiveBalance.toLocaleString()}
                    </p>
                    <div className="flex justify-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">🏦 Loan: ${snapshot.balance.toLocaleString()}</span>
                      <span className="text-gray-300">|</span>
                      <span className="flex items-center gap-1">💰 Offset: ${snapshot.offset.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* SECONDARY METRICS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 text-center">
                      <p className="text-xs font-bold text-orange-600 uppercase mb-1">Interest (Monthly)</p>
                      <p className="text-xl font-bold text-gray-800">
                        Paying ~${snapshot.monthlyInterestPaid.toLocaleString()}/mo
                      </p>
                      <p className="text-xs text-orange-400 mt-1">at this point in time</p>
                    </div>

                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 text-center">
                      <p className="text-xs font-bold text-purple-600 uppercase mb-1">Interest Paid (Total)</p>
                      <p className="text-xl font-bold text-gray-800">
                        ${snapshot.totalInterestPaid.toLocaleString()}
                      </p>
                      <p className="text-xs text-purple-400 mt-1">accumulated so far</p>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-center">
                      <p className="text-xs font-bold text-blue-600 uppercase mb-1">Time Remaining</p>
                      <p className="text-xl font-bold text-gray-800">
                        {yearsRem}y {monthsRem}m
                      </p>
                      <p className="text-xs text-blue-400 mt-1">until mortgage free</p>
                    </div>
                  </div>

                  {/* PROGRESS BAR */}
                  <div className="mt-2">
                    <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
                      <span>Effective Ownership</span>
                      <span>{effectiveProgress.toFixed(1)}% Owned</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden relative">
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
                    <p className="text-xs text-gray-400 mt-1 text-center">
                      (Green bar = Principal Paid + Money sitting in Offset)
                    </p>
                  </div>

                  {/* EVENTS & STATUS LOG */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      📅 Financial Events Log <span className="text-xs font-normal text-gray-500">(at Month {timelineMonth})</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">

                      {/* COLUMN 1: INCOME CONTEXT */}
                      <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                        <p className="font-bold text-green-800 border-b border-green-200 pb-1 mb-2">Income Context</p>
                        <div className="space-y-1 text-xs">
                          {(() => {
                            const tenantsActiveHere = incomeSources.filter(i => i.isShared !== undefined && isScheduleActive(i, timelineMonth));
                            const rentalIncomeHere = calculateMonthlyFromWeekly(getActiveAmount(incomeSources.filter(i => i.isShared !== undefined), timelineMonth));
                            const personalIncomeHere = calculateMonthlyFromWeekly(getActiveAmount(incomeSources.filter(i => i.isShared === undefined), timelineMonth));
                            return (
                              <>
                                <p className="flex justify-between">
                                  <span>Personal Income:</span>
                                  <span className="font-medium">${Math.round(personalIncomeHere).toLocaleString()}/mo</span>
                                </p>
                                <p className="flex justify-between">
                                  <span>Tenants Active:</span>
                                  <span className="font-medium">{tenantsActiveHere.length}</span>
                                </p>
                                <p className="flex justify-between">
                                  <span>Rental Income:</span>
                                  <span className="font-medium">${Math.round(rentalIncomeHere).toLocaleString()}/mo</span>
                                </p>
                              </>
                            );
                          })()}
                          <div className="mt-2 pt-2 border-t border-green-200">
                            {incomeSources.map(inc => {
                              let status = 'active';
                              if (timelineMonth < inc.startMonth) status = 'future';
                              else if (inc.recurrence === 'none') {
                                if (timelineMonth > inc.startMonth) status = 'past';
                              } else if (timelineMonth > inc.endMonth) status = 'past';
                              if (status === 'future') return null;
                              return (
                                <p key={`income-${inc.id}`} className={`truncate ${status === 'past' ? 'text-gray-400' : 'text-green-700'}`}>
                                  • {inc.isShared !== undefined ? `${inc.isShared ? `Shared (${inc.numPeople} × $${inc.amountPerPerson})` : 'Individual'}` : inc.name}
                                  {status === 'past' && ' (Done)'}
                                </p>
                              );
                            })}
                            {incomeSources.length === 0 && (
                              <span className="italic text-gray-400">No tenants or income sources</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* COLUMN 2: OFFSET HISTORY */}
                      <div className="bg-cyan-50 rounded-lg p-3 border border-cyan-100">
                        <p className="font-bold text-cyan-800 border-b border-cyan-200 pb-1 mb-2">Offset History (Cumulative)</p>
                        <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
                          {offsetContributions
                            .filter(c => c.startMonth <= timelineMonth)
                            .sort((a, b) => b.startMonth - a.startMonth) // newest first
                            .map(c => (
                              <div key={c.id} className="flex justify-between items-center text-cyan-700">
                                <span>{formatScheduleLabel(c)}:</span>
                                <span className="font-medium">
                                  +${(countOccurrencesUpTo(c, timelineMonth) * c.amount).toLocaleString()}
                                </span>
                              </div>
                            ))
                          }
                          {offsetContributions.filter(c => c.startMonth <= timelineMonth).length === 0 && (
                            <span className="italic text-gray-400">No contributions yet</span>
                          )}
                        </div>
                      </div>

                      {/* COLUMN 3: EXPENSE CONTEXT */}
                      <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
                        <p className="font-bold text-yellow-800 border-b border-yellow-200 pb-1 mb-2">Expenses Status</p>
                        <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
                          {exceptExpenses.map(exp => {
                            let status = 'active';
                            if (timelineMonth < exp.startMonth) status = 'future';
                            else if (exp.recurrence === 'none') {
                              if (timelineMonth > exp.startMonth) status = 'past';
                            } else if (timelineMonth > exp.endMonth) status = 'past';

                            if (status === 'future') return null;

                            return (
                              <div key={exp.id} className={`flex justify-between items-center ${status === 'active' ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                                <span>{exp.name} {status === 'past' && '(Done)'}</span>
                                <span className="font-medium">${exp.amount}</span>
                              </div>
                            );
                          })}
                          {exceptExpenses.filter(e => e.startMonth <= timelineMonth).length === 0 && (
                            <span className="italic text-gray-400">No expenses recorded</span>
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
    </div>
  );
};

export default PropertyInvestmentCalculator;