import React, { useState } from 'react';
import { DollarSign, Home, Users, TrendingDown, Calendar, ShoppingCart, Car } from 'lucide-react';

const PropertyInvestmentCalculator = () => {
  const [propertyPrice, setPropertyPrice] = useState(500000);
  const [downPayment, setDownPayment] = useState(250000);
  const [interestRate, setInterestRate] = useState(5.38);
  const [strataFees, setStrataFees] = useState(1000);
  const [utilities, setUtilities] = useState(200);
  const [councilRates, setCouncilRates] = useState(450);
  const [insurance, setInsurance] = useState(80);

  // Rental options
  const [tenants, setTenants] = useState([]);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [newTenantType, setNewTenantType] = useState('single');
  const [newTenantRent, setNewTenantRent] = useState(250);

  // Your personal expenses
  const [fortnightlyIncome, setFortnightlyIncome] = useState(3228);
  const [foodExpenses, setFoodExpenses] = useState(100);
  const [transportExpenses, setTransportExpenses] = useState(50);
  const [otherExpenses, setOtherExpenses] = useState(50);

  // Initial offset
  const [initialOffset, setInitialOffset] = useState(0);

  // Offset contributions state
  const [offsetContributions, setOffsetContributions] = useState([]);
  const [showAddContribution, setShowAddContribution] = useState(false);
  const [newContribMonth, setNewContribMonth] = useState(1);
  const [newContribAmount, setNewContribAmount] = useState(10000);

  // Exceptional Expenses State
  const [exceptExpenses, setExceptExpenses] = useState([]);
  const [showAddExceptExp, setShowAddExceptExp] = useState(false);
  const [newExpName, setNewExpName] = useState('Rent');
  const [newExpAmount, setNewExpAmount] = useState(920);
  const [newExpType, setNewExpType] = useState('recurring'); // one-time | recurring
  const [newExpMonth, setNewExpMonth] = useState(1); // for one-time
  const [newExpRecurrence, setNewExpRecurrence] = useState('period'); // forever | period
  const [newExpStart, setNewExpStart] = useState(1);
  const [newExpEnd, setNewExpEnd] = useState(4);

  // Timeline Explorer State
  const [timelineMonth, setTimelineMonth] = useState(0);

  // Calculate total scheduled offset contributions
  const totalScheduledOffset = offsetContributions.reduce((sum, contrib) => sum + contrib.amount, 0);

  // Helper function to format months in different ways
  const formatMonthsDetailed = (months) => {
    const totalYears = (months / 12).toFixed(1);
    const wholeYears = Math.floor(months / 12);
    const remainingMonths = months % 12;
    const humanReadable = remainingMonths === 0
      ? `${wholeYears} ${wholeYears === 1 ? 'year' : 'years'}`
      : `${wholeYears} ${wholeYears === 1 ? 'year' : 'years'} ${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`;

    return {
      decimal: totalYears,
      technical: months,
      human: humanReadable
    };
  };

  // Loan calculations
  const loanAmount = propertyPrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const totalMonths = 30 * 12;
  const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
    (Math.pow(1 + monthlyRate, totalMonths) - 1);

  // Monthly property expenses
  const monthlyStrata = strataFees / 4;
  const monthlyCouncil = councilRates / 4;
  const monthlyPropertyExpenses = monthlyStrata + utilities + monthlyCouncil + insurance;
  const totalPropertyCost = monthlyPayment + monthlyPropertyExpenses;

  // Interest deduction - Check for Month 1 offset
  const month1Offset = offsetContributions.find(c => c.month === 1)?.amount || 0;
  const initialPrincipal = Math.max(0, loanAmount - month1Offset);
  const initialMonthlyInterest = initialPrincipal * monthlyRate;

  // Rental income
  const weeklyRentalIncome = tenants.reduce((sum, t) => sum + t.amount, 0);
  const monthlyRentalIncome = weeklyRentalIncome * 52 / 12;

  // Property balance
  const monthlyPropertyBalance = monthlyRentalIncome - totalPropertyCost;
  const weeklyPropertyBalance = monthlyPropertyBalance * 12 / 52;

  // Your personal expenses
  const weeklyPersonalExpenses = foodExpenses + transportExpenses + otherExpenses;
  const monthlyPersonalExpenses = weeklyPersonalExpenses * 52 / 12;

  // Total cash flow
  const fortnightlyIncomeBiweekly = fortnightlyIncome;
  const weeklyIncome = fortnightlyIncome * 26 / 52;
  const monthlyIncome = fortnightlyIncome * 26 / 12;

  // NET WEEKLY/MONTHLY BALANCE
  const weeklyNetBalance = weeklyIncome - weeklyPersonalExpenses - weeklyPropertyBalance;
  const monthlyNetBalance = monthlyIncome - monthlyPersonalExpenses - Math.abs(monthlyPropertyBalance);
  const fortnightlyNetBalance = weeklyNetBalance * 2;

  // What you can deposit to offset
  const monthlyToOffset = Math.max(0, monthlyNetBalance);
  const weeklyToOffset = Math.max(0, weeklyNetBalance);
  const fortnightlyToOffset = Math.max(0, fortnightlyNetBalance);

  // Complete loan simulation with offset
  const calculateLoanWithOffset = (contributions = offsetContributions) => {
    if (monthlyToOffset <= 0 && contributions.reduce((s, c) => s + c.amount, 0) === 0) {
      return { years: 999, totalInterest: 999999, monthlyData: [] };
    }

    let balance = loanAmount;
    let offsetBalance = 0;
    let totalInterest = 0;
    let months = 0;
    const maxMonths = 30 * 12;
    const monthlyData = [];

    while (balance > 0.01 && months < maxMonths) {
      months++;

      // Apply any scheduled offset contributions for this month
      contributions.forEach(contrib => {
        if (contrib.month === months) {
          offsetBalance += contrib.amount;
        }
      });

      // Calculate Exceptional Expenses for this month
      let monthlyExceptionalCost = 0;
      exceptExpenses.forEach(exp => {
        if (exp.type === 'one-time' && exp.month === months) {
          monthlyExceptionalCost += exp.amount;
        } else if (exp.type === 'recurring') {
          if (exp.recurrence === 'forever') {
            monthlyExceptionalCost += exp.amount;
          } else if (exp.recurrence === 'period' && months >= exp.startMonth && months <= exp.endMonth) {
            monthlyExceptionalCost += exp.amount;
          }
        }
      });

      // Add regular monthly deposit to offset (reduced by exceptional expenses)
      // We assume exceptional expenses come out of the surplus first.
      const netMonthlyDeposit = Math.max(0, monthlyToOffset - monthlyExceptionalCost);
      offsetBalance += netMonthlyDeposit;

      // Offset cannot exceed loan balance
      const effectiveOffset = Math.min(offsetBalance, balance);

      // Balance on which interest is calculated
      const effectiveBalance = balance - effectiveOffset;

      // Monthly interest on effective balance
      const monthlyInterest = effectiveBalance * monthlyRate;
      totalInterest += monthlyInterest;

      // Pay the installment (interest + principal)
      const principalPayment = monthlyPayment - monthlyInterest;
      balance = Math.max(0, balance - principalPayment);

      // Save data for Timeline Explorer (Every Month)
      monthlyData.push({
        month: months,
        balance: Math.round(balance),
        offset: Math.round(effectiveOffset),
        effectiveBalance: Math.round(effectiveBalance),
        monthlyInterestPaid: Math.round(monthlyInterest),
        totalInterestPaid: Math.round(totalInterest),
        totalPrincipalPaid: Math.round(loanAmount - balance)
      });

      // If offset >= remaining balance, we're done
      if (effectiveOffset >= balance) {
        balance = 0;
        break;
      }
    }

    return {
      years: months / 12,
      months: months,
      totalInterest: totalInterest,
      monthlyData: monthlyData
    };
  };

  const loanSimulation = calculateLoanWithOffset(offsetContributions);
  const baselineSimulation = calculateLoanWithOffset([]); // No offsets
  const interestSaved = baselineSimulation.totalInterest - loanSimulation.totalInterest;
  const yearsToPayOff = loanSimulation.years;

  // Helper to get next month
  const getNextSuggestion = (list) => {
    if (list.length === 0) return 1;
    return Math.max(...list.map(c => c.month)) + 1;
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
    const newTenant = {
      id: Date.now(),
      type: newTenantType,
      amount: newTenantRent
    };
    setTenants([...tenants, newTenant]);
    setShowAddTenant(false);
    setNewTenantRent(250);
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

  const getBalanceColor = (value) => {
    if (value >= 300) return 'text-green-600';
    if (value >= 0) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBalanceBgColor = (value) => {
    if (value >= 300) return 'bg-green-50 border-green-300';
    if (value >= 0) return 'bg-yellow-50 border-yellow-300';
    return 'bg-red-50 border-red-300';
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Property Price: ${propertyPrice.toLocaleString()} AUD
                </label>
                <input
                  type="range"
                  min="300000"
                  max="800000"
                  step="10000"
                  value={propertyPrice}
                  onChange={(e) => setPropertyPrice(Number(e.target.value))}
                  className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Down Payment: ${downPayment.toLocaleString()} AUD
                </label>
                <input
                  type="range"
                  min="50000"
                  max={Math.min(propertyPrice, 400000)}
                  step="10000"
                  value={downPayment}
                  onChange={(e) => setDownPayment(Number(e.target.value))}
                  className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Loan: ${loanAmount.toLocaleString()} ({((loanAmount / propertyPrice) * 100).toFixed(1)}% LVR)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interest Rate: {interestRate}% p.a.
                </label>
                <input
                  type="range"
                  min="4.0"
                  max="8.0"
                  step="0.1"
                  value={interestRate}
                  onChange={(e) => setInterestRate(Number(e.target.value))}
                  className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-gray-700">
                  Monthly Payment: ${Math.round(monthlyPayment).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Property Expenses */}
          <div className="bg-white rounded-lg shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
              <DollarSign size={24} className="text-orange-600" />
              Property Expenses
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Strata (quarterly): ${strataFees}
                </label>
                <input
                  type="range"
                  min="600"
                  max="3000"
                  step="100"
                  value={strataFees}
                  onChange={(e) => setStrataFees(Number(e.target.value))}
                  className="w-full h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-gray-500">≈ ${Math.round(strataFees / 4)}/month</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Utilities (monthly): ${utilities}
                </label>
                <input
                  type="range"
                  min="50"
                  max="400"
                  step="10"
                  value={utilities}
                  onChange={(e) => setUtilities(Number(e.target.value))}
                  className="w-full h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Council Rates (quarterly): ${councilRates}
                </label>
                <input
                  type="range"
                  min="200"
                  max="800"
                  step="50"
                  value={councilRates}
                  onChange={(e) => setCouncilRates(Number(e.target.value))}
                  className="w-full h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-gray-500">≈ ${Math.round(councilRates / 4)}/month</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Insurance (monthly): ${insurance}
                </label>
                <input
                  type="range"
                  min="40"
                  max="200"
                  step="10"
                  value={insurance}
                  onChange={(e) => setInsurance(Number(e.target.value))}
                  className="w-full h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
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
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Weekly Rent ($): {newTenantRent}
                      </label>
                      <input
                        type="range"
                        min="50"
                        max="600"
                        step="10"
                        value={newTenantRent}
                        onChange={(e) => setNewTenantRent(Number(e.target.value))}
                        className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${newTenantType === 'single' ? 'bg-green-200' : 'bg-blue-200'}`}
                      />
                    </div>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fortnightly Income: ${fortnightlyIncome}
                </label>
                <input
                  type="range"
                  min="2000"
                  max="5000"
                  step="100"
                  value={fortnightlyIncome}
                  onChange={(e) => setFortnightlyIncome(Number(e.target.value))}
                  className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-gray-500">≈ ${Math.round(weeklyIncome)}/week</p>
              </div>

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
                    <div className="grid grid-cols-2 gap-3 mb-3">
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
                      <p className="text-xs text-gray-600">
                        Reduces {((totalScheduledOffset / loanAmount) * 100).toFixed(1)}% of loan balance
                      </p>
                      <p className="text-xs font-semibold text-green-700">
                        ~${Math.round(interestSaved).toLocaleString()} saved in interest
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Food: ${foodExpenses}
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="400"
                    step="10"
                    value={foodExpenses}
                    onChange={(e) => setFoodExpenses(Number(e.target.value))}
                    className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transport: ${transportExpenses}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="300"
                    step="10"
                    value={transportExpenses}
                    onChange={(e) => setTransportExpenses(Number(e.target.value))}
                    className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Other: ${otherExpenses}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="10"
                    value={otherExpenses}
                    onChange={(e) => setOtherExpenses(Number(e.target.value))}
                    className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
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
                            <div className="grid grid-cols-2 gap-2">
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
                    <span className="text-orange-600">-${Math.round(initialMonthlyInterest).toLocaleString()}</span>
                    {month1Offset > 0 && <span className="text-xs text-green-600 ml-1 self-center">(offset applied)</span>}
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
                    background: `conic-gradient(#ef4444 ${Math.min(100, ((totalPropertyCost + monthlyPersonalExpenses) / (monthlyIncome + monthlyRentalIncome)) * 100)}%, #22c55e 0)`
                  }}>
                    <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-500">
                        {Math.round(((totalPropertyCost + monthlyPersonalExpenses) / (monthlyIncome + monthlyRentalIncome)) * 100)}%
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
                  <p>Without offset (30 years): ~$272,000</p>
                  <p className="text-yellow-300 font-bold">
                    You save: ~${Math.round(272000 - loanSimulation.totalInterest).toLocaleString()}
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
                  monthlyInterestPaid: Math.round(initialMonthlyInterest),
                  totalInterestPaid: 0,
                  totalPrincipalPaid: 0
                }
                : (loanSimulation.monthlyData.find(d => d.month === timelineMonth) || loanSimulation.monthlyData[loanSimulation.monthlyData.length - 1]);

              if (!snapshot) return null;

              const effectiveProgress = Math.min(100, ((loanAmount - snapshot.effectiveBalance) / loanAmount) * 100);
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
                        style={{ left: `${(snapshot.totalPrincipalPaid / loanAmount) * 100}%` }}
                        title="Principal Paid (Direct)"
                      ></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-center">
                      (Green bar = Principal Paid + Money sitting in Offset)
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

        </div>
      </div>
    </div>
  );
};

export default PropertyInvestmentCalculator;