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
  const [rentalOption, setRentalOption] = useState('single');
  const [singleRoomRent, setSingleRoomRent] = useState(240);
  const [sharedRoomRent, setSharedRoomRent] = useState(160);
  
  // Your personal expenses
  const [fortnightlyIncome, setFortnightlyIncome] = useState(3228);
  const [foodExpenses, setFoodExpenses] = useState(100);
  const [transportExpenses, setTransportExpenses] = useState(50);
  const [otherExpenses, setOtherExpenses] = useState(50);
  
  // Initial offset
  const [initialOffset, setInitialOffset] = useState(0);
  const [depositStartMonth, setDepositStartMonth] = useState(0);

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
  
  // Rental income
  let weeklyRentalIncome = 0;
  if (rentalOption === 'single') {
    weeklyRentalIncome = singleRoomRent;
  } else if (rentalOption === 'shared') {
    weeklyRentalIncome = sharedRoomRent * 2;
  }
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
  const calculateLoanWithOffset = () => {
    if (monthlyToOffset <= 0 && initialOffset === 0) {
      return { years: 999, totalInterest: 999999, monthlyData: [] };
    }
    
    let balance = loanAmount;
    let offsetBalance = initialOffset;
    let totalInterest = 0;
    let months = 0;
    const maxMonths = 30 * 12;
    const monthlyData = [];
    
    while (balance > 0.01 && months < maxMonths) {
      months++;
      
      // Add monthly deposit to offset ONLY after start month
      if (months > depositStartMonth) {
        offsetBalance += monthlyToOffset;
      }
      
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
      
      // If offset >= remaining balance, we're done
      if (effectiveOffset >= balance) {
        balance = 0;
        break;
      }
      
      // Save data for chart (every 3 months)
      if (months % 3 === 0) {
        monthlyData.push({
          month: months,
          balance: Math.round(balance),
          offset: Math.round(effectiveOffset),
          effectiveBalance: Math.round(effectiveBalance)
        });
      }
    }
    
    return {
      years: months / 12,
      months: months,
      totalInterest: totalInterest,
      monthlyData: monthlyData
    };
  };
  
  const loanSimulation = calculateLoanWithOffset();
  const yearsToPayOff = loanSimulation.years;

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
                  Loan: ${loanAmount.toLocaleString()} ({((loanAmount/propertyPrice)*100).toFixed(1)}% LVR)
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
                <p className="text-xs text-gray-500">≈ ${Math.round(strataFees/4)}/month</p>
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
                <p className="text-xs text-gray-500">≈ ${Math.round(councilRates/4)}/month</p>
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
              <div className="flex gap-3">
                <button
                  onClick={() => setRentalOption('none')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    rentalOption === 'none' 
                      ? 'bg-gray-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  No Rental
                </button>
                <button
                  onClick={() => setRentalOption('single')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    rentalOption === 'single' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-blue-200 text-blue-700 hover:bg-blue-300'
                  }`}
                >
                  1 Room
                </button>
                <button
                  onClick={() => setRentalOption('shared')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    rentalOption === 'shared' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-green-200 text-green-700 hover:bg-green-300'
                  }`}
                >
                  2 Rooms
                </button>
              </div>

              {rentalOption === 'single' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weekly Rent: ${singleRoomRent}/week
                  </label>
                  <input
                    type="range"
                    min="150"
                    max="400"
                    step="10"
                    value={singleRoomRent}
                    onChange={(e) => setSingleRoomRent(Number(e.target.value))}
                    className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}

              {rentalOption === 'shared' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rent per Person: ${sharedRoomRent}/week
                  </label>
                  <input
                    type="range"
                    min="100"
                    max="350"
                    step="10"
                    value={sharedRoomRent}
                    onChange={(e) => setSharedRoomRent(Number(e.target.value))}
                    className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Total: ${sharedRoomRent * 2}/week
                  </p>
                </div>
              )}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Offset (day 1): ${initialOffset.toLocaleString()}
                </label>
                <input
                  type="range"
                  min="0"
                  max="100000"
                  step="5000"
                  value={initialOffset}
                  onChange={(e) => setInitialOffset(Number(e.target.value))}
                  className="w-full h-2 bg-cyan-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-gray-500">
                  {initialOffset > 0 
                    ? `Already reducing ${((initialOffset/loanAmount)*100).toFixed(1)}% of loan from start`
                    : 'Starting from zero in offset'
                  }
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Deposits at Month: {depositStartMonth === 0 ? 'Immediately' : `${depositStartMonth} (${formatMonthsDetailed(depositStartMonth).human})`}
                </label>
                <input
                  type="range"
                  min="0"
                  max="24"
                  step="1"
                  value={depositStartMonth}
                  onChange={(e) => setDepositStartMonth(Number(e.target.value))}
                  className="w-full h-2 bg-teal-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-gray-500">
                  {depositStartMonth === 0 
                    ? 'Start depositing to offset from month 1'
                    : depositStartMonth === 1
                    ? 'First deposit at month 2 (settling time)'
                    : `First deposit after ${depositStartMonth} months (${formatMonthsDetailed(depositStartMonth).human} settling time)`
                  }
                </p>
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
            </div>
          </div>

        </div>

        {/* RIGHT PANEL - Results */}
        <div className="space-y-4">
          
          {/* Property Balance */}
          <div className="bg-white rounded-lg shadow-md p-5">
            <h2 className="text-lg font-bold text-gray-700 mb-3">🏠 Property Balance</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Loan + expenses:</span>
                <span className="font-semibold text-red-600">-${Math.round(totalPropertyCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rental income:</span>
                <span className="font-semibold text-green-600">+${Math.round(monthlyRentalIncome)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Difference:</span>
                <span className={monthlyPropertyBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {monthlyPropertyBalance >= 0 ? '+' : ''}${Math.round(monthlyPropertyBalance)}/month
                </span>
              </div>
              <p className="text-xs text-gray-500 text-center">
                {monthlyPropertyBalance >= 0 
                  ? '✅ Rent covers property costs'
                  : `❌ Need $${Math.round(Math.abs(monthlyPropertyBalance))}/month extra`
                }
              </p>
            </div>
          </div>

          {/* COMPLETE CASH FLOW */}
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg p-5 text-white">
            <h2 className="text-lg font-bold mb-3">💰 Your Total Cash Flow</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Fortnightly income:</span>
                <span className="font-semibold">+${fortnightlyIncome}</span>
              </div>
              <div className="flex justify-between">
                <span>Personal expenses:</span>
                <span className="font-semibold">-${Math.round(weeklyPersonalExpenses * 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Property balance:</span>
                <span className="font-semibold">
                  {monthlyPropertyBalance >= 0 ? '+' : ''}{Math.round(monthlyPropertyBalance * 2 / 4)}
                </span>
              </div>
              <div className="border-t border-white/30 pt-2 flex justify-between font-bold text-base">
                <span>YOU KEEP:</span>
                <span className="text-yellow-300">
                  ${Math.round(fortnightlyNetBalance)}/fortnight
                </span>
              </div>
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
          {(monthlyToOffset > 0 || initialOffset > 0) && (
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
                
                {depositStartMonth > 0 && (
                  <div className="bg-yellow-400/30 backdrop-blur rounded-lg p-2 text-xs">
                    <p className="font-semibold">⏳ Waiting period:</p>
                    <p>First {depositStartMonth} months ({formatMonthsDetailed(depositStartMonth).human}) without offset deposits</p>
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
        </div>
      </div>
    </div>
  );
};

export default PropertyInvestmentCalculator;