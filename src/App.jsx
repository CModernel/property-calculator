import React, { useState } from 'react';
import { DollarSign, Home, Users, TrendingDown, Calendar, ShoppingCart, Car } from 'lucide-react';
import { formatMonthsDetailed, formatCompactMoney } from './calculations/formatting';
import NumberSliderField from './components/NumberSliderField';
import { getNextSuggestion } from './calculations/suggestions';
import { getBalanceColor, getBalanceBgColor } from './calculations/ui';
import {
  calculateLoanAmount,
  calculateMonthlyRate,
  calculateMonthlyPayment,
  calculateMonthlyStrata,
  calculateMonthlyCouncil,
  calculateMonthlyPropertyExpenses,
  calculateTotalPropertyCost,
  calculateInitialMonthlyInterest,
  calculateNoOffsetTotalInterest,
  calculateWeeklyRentalIncome,
  calculateMonthlyRentalIncome,
  calculateWeeklyPersonalExpenses,
  calculateMonthlyPersonalExpenses,
  calculateWeeklyIncome,
  calculateMonthlyIncome,
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
import { isMonthInRange } from './calculations/dateRange';
import { getSteppedValue } from './calculations/steppedValue';
import { useSteppedValue } from './hooks/useSteppedValue';
import SteppedExpenseField from './components/SteppedExpenseField';
import defaultConfig from '../config.default.json';

// config.local.json is git-ignored and optional - import.meta.glob resolves to
// an empty object (not a build error) when the file doesn't exist, so no
// runtime fetch or fallback branching is needed for the common case.
const localConfigModules = import.meta.glob('../config.local.json', { eager: true });
const localConfig = Object.values(localConfigModules)[0]?.default ?? {};
const config = { ...defaultConfig, ...localConfig };

const PropertyInvestmentCalculator = () => {
  const [propertyPrice, setPropertyPrice] = useState(config.propertyPrice);
  const [downPayment, setDownPayment] = useState(config.downPayment);
  const [interestRate, setInterestRate] = useState(config.interestRate);
  const [loanTermYears, setLoanTermYears] = useState(config.loanTermYears);
  const strataFeesField = useSteppedValue(config.strataFees);
  const utilitiesField = useSteppedValue(config.utilities);
  const councilRatesField = useSteppedValue(config.councilRates);
  const insuranceField = useSteppedValue(config.insurance);

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

  // Rental options
  const [tenants, setTenants] = useState([]);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [newTenantType, setNewTenantType] = useState('single');
  const [newTenantRent, setNewTenantRent] = useState(config.newTenantRent);
  const [newTenantHasDateRange, setNewTenantHasDateRange] = useState(true);
  const [newTenantStartMonth, setNewTenantStartMonth] = useState(config.newTenantStartMonth);
  const [newTenantHasEndMonth, setNewTenantHasEndMonth] = useState(false);
  const [newTenantEndMonth, setNewTenantEndMonth] = useState(24);

  // Your personal expenses
  const [fortnightlyIncome, setFortnightlyIncome] = useState(config.fortnightlyIncome);
  const foodExpensesField = useSteppedValue(config.foodExpenses);
  const transportExpensesField = useSteppedValue(config.transportExpenses);
  const otherExpensesField = useSteppedValue(config.otherExpenses);

  // Offset contributions state
  const [offsetContributions, setOffsetContributions] = useState([]);
  const [showAddContribution, setShowAddContribution] = useState(false);
  const [newContribMonth, setNewContribMonth] = useState(1);
  const [newContribAmount, setNewContribAmount] = useState(config.newContribAmount);

  // Exceptional Expenses State
  const [exceptExpenses, setExceptExpenses] = useState([]);
  const [showAddExceptExp, setShowAddExceptExp] = useState(false);
  const [newExpName, setNewExpName] = useState('Rent');
  const [newExpAmount, setNewExpAmount] = useState(config.newExpAmount);
  const [newExpType, setNewExpType] = useState('recurring'); // one-time | recurring
  const [newExpMonth, setNewExpMonth] = useState(1); // for one-time
  const [newExpRecurrence, setNewExpRecurrence] = useState('period'); // forever | period
  const [newExpStart, setNewExpStart] = useState(1);
  const [newExpEnd, setNewExpEnd] = useState(4);

  // Timeline Explorer State
  const [timelineMonth, setTimelineMonth] = useState(0);

  // Calculate total scheduled offset contributions
  const totalScheduledOffset = calculateTotalScheduledOffset(offsetContributions);

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
  const strataFees = getSteppedValue(strataFeesField.base, strataFeesField.changes, 1);
  const utilities = getSteppedValue(utilitiesField.base, utilitiesField.changes, 1);
  const councilRates = getSteppedValue(councilRatesField.base, councilRatesField.changes, 1);
  const insurance = getSteppedValue(insuranceField.base, insuranceField.changes, 1);
  const foodExpenses = getSteppedValue(foodExpensesField.base, foodExpensesField.changes, 1);
  const transportExpenses = getSteppedValue(transportExpensesField.base, transportExpensesField.changes, 1);
  const otherExpenses = getSteppedValue(otherExpensesField.base, otherExpensesField.changes, 1);

  // Monthly property expenses
  const monthlyStrata = calculateMonthlyStrata(strataFees);
  const monthlyCouncil = calculateMonthlyCouncil(councilRates);
  const monthlyPropertyExpenses = calculateMonthlyPropertyExpenses(monthlyStrata, utilities, monthlyCouncil, insurance);
  const totalPropertyCost = calculateTotalPropertyCost(monthlyPayment, monthlyPropertyExpenses);

  // Interest on the full balance, before any offset is applied.
  // This is the Timeline Explorer's "month 0" figure: nothing has happened yet,
  // so it must stay consistent with that snapshot's offset: 0 / effectiveBalance: loanAmount.
  const monthZeroInterest = calculateInitialMonthlyInterest(loanAmount, monthlyRate);

  // Rental income. These static cards describe the recurring situation "right
  // now" (month 1), same as exceptional expenses never touch them either -
  // a tenant who hasn't moved in yet, or already moved out, shouldn't count.
  const activeTenantsNow = tenants.filter(t => isMonthInRange(1, t.startMonth, t.endMonth));
  const weeklyRentalIncome = calculateWeeklyRentalIncome(activeTenantsNow);
  const monthlyRentalIncome = calculateMonthlyRentalIncome(weeklyRentalIncome);

  // Your personal expenses
  const weeklyPersonalExpenses = calculateWeeklyPersonalExpenses(foodExpenses, transportExpenses, otherExpenses);
  const monthlyPersonalExpenses = calculateMonthlyPersonalExpenses(weeklyPersonalExpenses);

  // Total cash flow
  const weeklyIncome = calculateWeeklyIncome(fortnightlyIncome);
  const monthlyIncome = calculateMonthlyIncome(fortnightlyIncome);

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

  // Surplus feeding the simulation, EXCLUDING tenant rent and the 7 expense
  // fields, left unclamped. The loop adds/subtracts each of those back in per
  // month instead, since any of them can now change mid-simulation and so can
  // no longer be pre-collapsed into a single constant - clamping here first
  // would lose information once they're summed in afterwards (see
  // offsetSimulation.js).
  const baseMonthlySurplus = calculateMonthlyNetBalance(monthlyIncome, 0, 0, monthlyPayment);

  const expenseFields = {
    strataFees: strataFeesField,
    utilities: utilitiesField,
    councilRates: councilRatesField,
    insurance: insuranceField,
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
    tenants,
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
    tenants,
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

  // Functions for managing offset contributions
  const addOffsetContribution = () => {
    if (newContribAmount <= 0) return;

    // Check if month already exists
    const monthExists = offsetContributions.some(c => c.month === newContribMonth);
    if (monthExists) {
      alert('A contribution already exists for this month. Please remove it first or choose a different month.');
      return;
    }

    const newContrib = {
      id: Date.now(),
      month: newContribMonth,
      amount: newContribAmount
    };

    const updatedContributions = [...offsetContributions, newContrib].sort((a, b) => a.month - b.month);
    setOffsetContributions(updatedContributions);
    setShowAddContribution(false);
    setNewContribMonth(getNextSuggestion(updatedContributions));
    setNewContribAmount(10000);
  };

  const removeOffsetContribution = (id) => {
    const updatedContributions = offsetContributions.filter(c => c.id !== id);
    setOffsetContributions(updatedContributions);
    setNewContribMonth(getNextSuggestion(updatedContributions));
  };

  const addTenant = () => {
    if (newTenantRent <= 0) return;
    if (newTenantHasDateRange && newTenantHasEndMonth && newTenantStartMonth > newTenantEndMonth) {
      alert('Start month must be before end month.');
      return;
    }
    const newTenant = {
      id: Date.now(),
      type: newTenantType,
      amount: newTenantRent,
      startMonth: newTenantHasDateRange ? newTenantStartMonth : null,
      // No end date ticked means "ongoing" - open-ended, not "always active
      // regardless of start" (see isMonthInRange).
      endMonth: newTenantHasDateRange && newTenantHasEndMonth ? newTenantEndMonth : null,
    };
    setTenants([...tenants, newTenant]);
    setShowAddTenant(false);
    setNewTenantRent(config.newTenantRent);
    setNewTenantHasDateRange(true);
    setNewTenantStartMonth(config.newTenantStartMonth);
    setNewTenantHasEndMonth(false);
  };

  const removeTenant = (id) => {
    setTenants(tenants.filter(t => t.id !== id));
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

    if (newExpType === 'recurring' && newExpRecurrence === 'period' && newExpStart > newExpEnd) {
      alert('Start month must be before end month.');
      return;
    }

    const newExp = {
      id: Date.now(),
      name: newExpName,
      amount: newExpAmount,
      type: newExpType,
      month: newExpMonth, // relevant if one-time
      recurrence: newExpRecurrence, // relevant if recurring
      startMonth: newExpStart,
      endMonth: newExpEnd
    };

    setExceptExpenses([...exceptExpenses, newExp]);
    setShowAddExceptExp(false);
    setNewExpName('Rent');
    setNewExpAmount(920);
  };

  const removeExceptionalExpense = (id) => {
    setExceptExpenses(exceptExpenses.filter(e => e.id !== id));
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="bg-white rounded-xl shadow-xl p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
          <Home className="text-blue-600" size={36} />
          Property Investment Cash Flow Calculator
        </h1>
        <p className="text-gray-600">How much is left after EVERYTHING? That goes to offset automatically.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT PANEL - Configuration */}
        <div className="lg:col-span-2 space-y-4">

          {/* Property */}
          <div className="bg-white rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Home size={24} className="text-blue-600" />
              Property & Loan
            </h2>

            <div className="space-y-4">
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
                label="Down Payment"
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
              </NumberSliderField>

              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={isFirstHomeBuyer}
                  onChange={(e) => setIsFirstHomeBuyer(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                First Home Buyer (NSW stamp duty concession)
              </label>

              <NumberSliderField
                label="Total Savings Available"
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
                  Monthly Payment: ${Math.round(monthlyPayment).toLocaleString()}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-sm font-semibold text-gray-700">
                Property Subtotal: ${Math.round(monthlyPropertyExpenses)}/month
              </p>
            </div>
          </div>

          {/* Rental */}
          <div className="bg-white rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Users size={24} className="text-green-600" />
              Rental Income
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-md font-bold text-gray-700">👥 Tenants</h3>
                <button
                  onClick={() => setShowAddTenant(!showAddTenant)}
                  className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors"
                >
                  {showAddTenant ? '✕ Cancel' : '+ Add'}
                </button>
              </div>

              {/* Add tenant form */}
              {showAddTenant && (
                <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="col-span-2 flex gap-2">
                      <button
                        onClick={() => setNewTenantType('single')}
                        className={`flex-1 py-1 px-2 rounded text-sm ${newTenantType === 'single'
                          ? 'bg-green-600 text-white'
                          : 'bg-green-200 text-green-800'
                          }`}
                      >
                        Individual Room
                      </button>
                      <button
                        onClick={() => setNewTenantType('shared')}
                        className={`flex-1 py-1 px-2 rounded text-sm ${newTenantType === 'shared'
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-200 text-blue-800'
                          }`}
                      >
                        Shared Room
                      </button>
                    </div>
                    <div className="col-span-2">
                      <NumberSliderField
                        label="Weekly Rent"
                        value={newTenantRent}
                        onChange={setNewTenantRent}
                        min={0}
                        max={5000}
                        sliderMin={50}
                        sliderMax={1200}
                        step={10}
                        color={newTenantType === 'single' ? 'green' : 'blue'}
                        prefix="$"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                        <input
                          type="checkbox"
                          checked={newTenantHasDateRange}
                          onChange={(e) => setNewTenantHasDateRange(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        Limited period? (e.g. moves out, or moves in later)
                      </label>
                    </div>
                    {newTenantHasDateRange && (
                      <div className="col-span-2 space-y-2">
                        <div>
                          <label className="block text-xs font-medium mb-1">Start Month: {newTenantStartMonth}</label>
                          <input
                            type="range" min="1" max="360"
                            value={newTenantStartMonth}
                            onChange={(e) => setNewTenantStartMonth(Number(e.target.value))}
                            className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={newTenantHasEndMonth}
                            onChange={(e) => setNewTenantHasEndMonth(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          Has an end date? (leave unchecked for ongoing)
                        </label>
                        {newTenantHasEndMonth && (
                          <div>
                            <label className="block text-xs font-medium mb-1">End Month: {newTenantEndMonth}</label>
                            <input
                              type="range" min={newTenantStartMonth} max="360"
                              value={newTenantEndMonth}
                              onChange={(e) => setNewTenantEndMonth(Number(e.target.value))}
                              className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={addTenant}
                    className={`w-full py-2 text-white rounded-lg font-medium transition-colors ${newTenantType === 'single' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    Add Tenant
                  </button>
                </div>
              )}

              {/* List of tenants */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {tenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${tenant.type === 'single' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {tenant.type === 'single' ? '👤' : '👥'}
                        <div>
                          <p className="font-semibold text-gray-800">
                            {tenant.type === 'single' ? 'Individual Room' : 'Shared Room'}
                          </p>
                          <p className="text-xs text-gray-600">
                            ${tenant.amount}/week {tenant.type === 'shared' && <span className="text-blue-600 font-medium">(~${Math.round(tenant.amount / 2)} each)</span>}
                            {tenant.startMonth != null && (
                              <span className="text-gray-500">
                                {tenant.endMonth != null
                                  ? ` (Months ${tenant.startMonth}-${tenant.endMonth})`
                                  : ` (From month ${tenant.startMonth})`}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeTenant(tenant.id)}
                      className="ml-3 px-2 py-1 bg-red-400 text-white rounded hover:bg-red-500 transition-colors text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {tenants.length === 0 && !showAddTenant && (
                  <p className="text-sm text-gray-500 text-center italic py-2">No tenants added yet.</p>
                )}
              </div>

              <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm font-semibold text-gray-700 text-center">
                  Total Weekly Rent: <span className="text-green-700 text-lg">${weeklyRentalIncome.toLocaleString()}</span>
                </p>
              </div>
            </div>
          </div>

          {/* YOUR PERSONAL EXPENSES */}
          <div className="bg-white rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
              <ShoppingCart size={24} className="text-purple-600" />
              Your Personal Expenses (Weekly)
            </h2>

            <div className="space-y-4">
              <NumberSliderField
                label="Fortnightly Income"
                value={fortnightlyIncome}
                onChange={setFortnightlyIncome}
                min={0}
                max={100000}
                sliderMin={1000}
                sliderMax={12000}
                step={100}
                color="indigo"
                prefix="$"
              >
                ≈ ${Math.round(weeklyIncome)}/week
              </NumberSliderField>

              {/* OFFSET CONTRIBUTIONS SECTION */}
              <div className="border-t pt-4 mt-4">
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
                  <div className="mb-3 p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          At Month
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="360"
                          value={newContribMonth}
                          onChange={(e) => setNewContribMonth(Number(e.target.value))}
                          className="w-full h-2 bg-cyan-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="text-center text-sm font-medium text-gray-700">
                          {newContribMonth} months
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Amount ($)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="500000"
                          step="1000"
                          value={newContribAmount}
                          onChange={(e) => setNewContribAmount(Number(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>
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
                              Month {contrib.month}
                            </p>
                            <p className="text-xs text-gray-600">
                              {formatMonthsDetailed(contrib.month).human}
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
                    📊 Total Scheduled Offset: <span className="text-indigo-700 text-lg">${totalScheduledOffset.toLocaleString()}</span>
                  </p>
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

              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm font-semibold text-gray-700">
                  Total Personal Expenses: ${Math.round(weeklyPersonalExpenses)}/week
                  (≈ ${Math.round(monthlyPersonalExpenses)}/month)
                </p>
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

                      <div>
                        <label className="block font-medium text-gray-700 mb-1">Amount ($)</label>
                        <input
                          type="number"
                          value={newExpAmount}
                          onChange={(e) => setNewExpAmount(Number(e.target.value))}
                          className="w-full p-2 border rounded"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setNewExpType('one-time')}
                          className={`flex-1 py-1 rounded border ${newExpType === 'one-time' ? 'bg-yellow-200 border-yellow-400 font-bold' : 'bg-white'}`}
                        >One-Time</button>
                        <button
                          onClick={() => setNewExpType('recurring')}
                          className={`flex-1 py-1 rounded border ${newExpType === 'recurring' ? 'bg-yellow-200 border-yellow-400 font-bold' : 'bg-white'}`}
                        >Recurring</button>
                      </div>

                      {newExpType === 'one-time' && (
                        <div>
                          <label className="block font-medium text-gray-700 mb-1">Occurs at Month: {newExpMonth}</label>
                          <input
                            type="range" min="1" max="360"
                            value={newExpMonth}
                            onChange={(e) => setNewExpMonth(Number(e.target.value))}
                            className="w-full h-2 bg-yellow-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      )}

                      {newExpType === 'recurring' && (
                        <div className="space-y-3">
                          <div className="flex gap-2 text-xs">
                            <button
                              onClick={() => setNewExpRecurrence('forever')}
                              className={`flex-1 py-1 rounded border ${newExpRecurrence === 'forever' ? 'bg-orange-200 border-orange-400 font-bold' : 'bg-white'}`}
                            >Forever</button>
                            <button
                              onClick={() => setNewExpRecurrence('period')}
                              className={`flex-1 py-1 rounded border ${newExpRecurrence === 'period' ? 'bg-orange-200 border-orange-400 font-bold' : 'bg-white'}`}
                            >Specific Period</button>
                          </div>

                          {newExpRecurrence === 'period' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-medium mb-1">Start Month: {newExpStart}</label>
                                <input
                                  type="range" min="1" max="360"
                                  value={newExpStart}
                                  onChange={(e) => setNewExpStart(Number(e.target.value))}
                                  className="w-full h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1">End Month: {newExpEnd}</label>
                                <input
                                  type="range" min={newExpStart} max="360"
                                  value={newExpEnd}
                                  onChange={(e) => setNewExpEnd(Number(e.target.value))}
                                  className="w-full h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>
                            </div>
                          )}
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
                          ${exp.amount} • {exp.type === 'one-time' ? `Month ${exp.month}` : (exp.recurrence === 'forever' ? 'Forever' : `Months ${exp.startMonth}-${exp.endMonth}`)}
                        </p>
                      </div>
                      <button onClick={() => removeExceptionalExpense(exp.id)} className="text-red-500 font-bold px-2">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
                    <span className="text-gray-600">Monthly Payment:</span>
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
                    <span className="text-gray-600">LMI (estimate, {lvr.toFixed(1)}% LVR):</span>
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
                      <span className="text-gray-600">Scheduled Offset Contributions:</span>
                      <span className="font-semibold text-red-600">-${totalScheduledOffset.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Savings Available:</span>
                    <span className="font-semibold text-gray-700">${totalSavings.toLocaleString()}</span>
                  </div>
                  <div className={`border-t pt-1 mt-1 font-bold ${getBalanceBgColor(cashRemaining)}`}>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Cash Remaining:</span>
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
                        {(monthlyRentalIncome - totalPropertyCost) >= 0 ? '+' : ''}${Math.round(monthlyRentalIncome - totalPropertyCost).toLocaleString()}/month
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
                    <p>{offsetContributions.length} lump sum payments totaling ${totalScheduledOffset.toLocaleString()}</p>
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
            <li>Receive your fortnightly income</li>
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
                            const tenantsActiveHere = tenants.filter(t => isMonthInRange(timelineMonth, t.startMonth, t.endMonth));
                            const rentalIncomeHere = calculateMonthlyRentalIncome(calculateWeeklyRentalIncome(tenantsActiveHere));
                            return (
                              <>
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
                            {tenants.map(t => {
                              // No bound at all = always active. An unset endMonth
                              // means "ongoing" - never past, not "compare against null".
                              let status = 'active';
                              if (t.startMonth != null && timelineMonth < t.startMonth) status = 'future';
                              else if (t.endMonth != null && timelineMonth > t.endMonth) status = 'past';
                              if (status === 'future') return null;
                              return (
                                <p key={t.id} className={`truncate ${status === 'past' ? 'text-gray-400' : 'text-green-700'}`}>
                                  • {t.type === 'single' ? 'Individual' : 'Shared ($' + Math.round(t.amount / 2) + ')'}
                                  {status === 'past' && ' (Done)'}
                                  {t.startMonth != null && (
                                    <span className="text-gray-400">
                                      {t.endMonth != null ? ` (M${t.startMonth}-${t.endMonth})` : ` (from M${t.startMonth})`}
                                    </span>
                                  )}
                                </p>
                              );
                            })}
                            {tenants.length === 0 && <span className="italic text-gray-400">No tenants</span>}
                          </div>
                        </div>
                      </div>

                      {/* COLUMN 2: OFFSET HISTORY */}
                      <div className="bg-cyan-50 rounded-lg p-3 border border-cyan-100">
                        <p className="font-bold text-cyan-800 border-b border-cyan-200 pb-1 mb-2">Offset History (Cumulative)</p>
                        <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
                          {offsetContributions
                            .filter(c => c.month <= timelineMonth)
                            .sort((a, b) => b.month - a.month) // newest first
                            .map(c => (
                              <div key={c.id} className="flex justify-between items-center text-cyan-700">
                                <span>Month {c.month}:</span>
                                <span className="font-medium">+${c.amount.toLocaleString()}</span>
                              </div>
                            ))
                          }
                          {offsetContributions.filter(c => c.month <= timelineMonth).length === 0 && (
                            <span className="italic text-gray-400">No contributions yet</span>
                          )}
                        </div>
                      </div>

                      {/* COLUMN 3: EXPENSE CONTEXT */}
                      <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
                        <p className="font-bold text-yellow-800 border-b border-yellow-200 pb-1 mb-2">Expenses Status</p>
                        <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
                          {exceptExpenses.map(exp => {
                            let status = 'future';
                            if (exp.type === 'one-time') {
                              if (exp.month === timelineMonth) status = 'active';
                              else if (exp.month < timelineMonth) status = 'past';
                            } else {
                              // Recurring
                              if (exp.recurrence === 'forever') status = 'active'; // Simplified
                              else if (timelineMonth >= exp.startMonth && timelineMonth <= exp.endMonth) status = 'active';
                              else if (timelineMonth > exp.endMonth) status = 'past';
                            }

                            if (status === 'future') return null;

                            return (
                              <div key={exp.id} className={`flex justify-between items-center ${status === 'active' ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                                <span>{exp.name} {status === 'past' && '(Done)'}</span>
                                <span className="font-medium">${exp.amount}</span>
                              </div>
                            );
                          })}
                          {exceptExpenses.filter(e => e.month <= timelineMonth || e.startMonth <= timelineMonth).length === 0 && (
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