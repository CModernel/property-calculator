import NumberSliderField from './NumberSliderField';
import SteppedExpenseField from './SteppedExpenseField';
import HealthCheckIndicator from './HealthCheckIndicator';
import LvrBadge from './LvrBadge';
import {
  PROPERTY_PRICE_FIELD, depositContributionField, loanAmountField,
  AVAILABLE_SAVINGS_FIELD, INTEREST_RATE_FIELD, LOAN_TERM_FIELD,
} from './coreFieldConfigs';
// TODO-156: the same wording the Advanced panel uses. These used to be
// re-implemented inline here, which is how this view kept saying "Fails at
// +1%" long after TODO-148 taught Advanced to say "Already in deficit".
import { stressTestDisplay, bufferDisplay, bufferShortfallAction } from '../calculations/healthCheckDisplay';

// TODO-135: the "can I afford this?" view. Presentation ONLY - every figure
// here is passed in already computed by App.jsx, and this file performs no
// arithmetic beyond formatting and the two subtractions that make the monthly
// chain readable. Simple mode hides editors, it never changes the model (the
// rule TODO-141 established when it removed the old "Realistic Mode" gate).
//
// The six core fields are the SAME controls Advanced shows, rendered from the
// shared configs in coreFieldConfigs.js so their ranges can't drift apart.

// Sign goes OUTSIDE the dollar sign - `$-9,937` reads as a typo, and the rest
// of the app already writes `-$9,937` (see the cash-flow figures in App.jsx).
const money = (value) => `${value < 0 ? '-' : ''}$${Math.abs(Math.round(value)).toLocaleString()}`;
const signedMoney = (value) => `${value >= 0 ? '+' : '-'}$${Math.abs(Math.round(value)).toLocaleString()}`;

const SimpleModeView = ({
  // Core editable inputs
  propertyPrice, onPropertyPriceChange,
  downPayment, onDownPaymentChange,
  loanAmount, onLoanAmountChange,
  totalSavings, onTotalSavingsChange,
  interestRateField,
  loanTermYears, onLoanTermYearsChange,
  lvr,
  // Already-computed results
  affordability,
  monthlyPayment,
  totalCashRequired,
  cashRemaining,
  monthlyNetBalance,
  monthlyIncome,
  monthlyRentalIncome,
  totalPropertyCost,
  monthlyPersonalExpenses,
  // Health Check subset (classifications already computed, incl. TODO-134
  // Day-1/Stabilized annotations)
  housingCostRatio, housingCostRatioClass, totalMonthlyIncomeBeforeTax,
  stressTestSurvivedDelta, stressTestClass, alreadyInDeficitAtCurrentRate,
  emergencyBufferMonths, emergencyBufferClass, liquidSavings,
  // Disclosure of what's included but not editable here
  incomeSourceCount,
  personalExpenseCount,
  offsetContributionCount,
  activeAdvancedFeatures,
  onSwitchToAdvanced,
}) => {
  const totalMonthlyIncome = monthlyIncome + monthlyRentalIncome;
  const totalMonthlyCosts = totalPropertyCost + monthlyPersonalExpenses;

  return (
    <div className="space-y-4">
      {/* Where you stand - a roll-up of the signals shown below, never a
          yes/no verdict (see affordabilitySummary.js). */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
        <p className={`text-xl font-bold ${affordability.textClass}`}>
          {affordability.symbol} {affordability.label}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{affordability.headline}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          A summary of the figures below, not a lending decision - a lender assesses your full circumstances and applies its own buffers.
        </p>
      </div>

      {/* The purchase itself */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 space-y-4">
        <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200">🏠 The purchase</h2>

        <NumberSliderField {...PROPERTY_PRICE_FIELD} value={propertyPrice} onChange={onPropertyPriceChange} />
        <NumberSliderField {...depositContributionField(propertyPrice)} value={downPayment} onChange={onDownPaymentChange}>
          Loan: {money(loanAmount)} ({lvr.toFixed(1)}% LVR)
          <LvrBadge lvr={lvr} />
        </NumberSliderField>
        <NumberSliderField {...loanAmountField(propertyPrice)} value={loanAmount} onChange={onLoanAmountChange} />
        <SteppedExpenseField {...INTEREST_RATE_FIELD} field={interestRateField} />
        <NumberSliderField {...LOAN_TERM_FIELD} value={loanTermYears} onChange={onLoanTermYearsChange} />
        <NumberSliderField {...AVAILABLE_SAVINGS_FIELD} value={totalSavings} onChange={onTotalSavingsChange} />
      </div>

      {/* Cash needed to get in the door */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
        <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-3">💰 Cash to settle</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-700 dark:text-gray-200">
              Total cash required
              <span className="block text-xs text-gray-500 dark:text-gray-400">Deposit + stamp duty + closing costs (+ LMI if paid upfront)</span>
            </dt>
            <dd className="font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">{money(totalCashRequired)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-700 dark:text-gray-200">
              Cash remaining
              <span className="block text-xs text-gray-500 dark:text-gray-400">What's left in the bank after settlement, uncommitted</span>
            </dt>
            <dd className={`font-semibold whitespace-nowrap ${cashRemaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {money(cashRemaining)}
            </dd>
          </div>
        </dl>
      </div>

      {/* The month-to-month picture */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
        <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-3">📅 Every month</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-700 dark:text-gray-200">Income in</dt>
            <dd className="font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">{signedMoney(totalMonthlyIncome)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-700 dark:text-gray-200">
              Loan repayment
              <span className="block text-xs text-gray-500 dark:text-gray-400">Included in property costs below</span>
            </dt>
            <dd className="font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">{money(monthlyPayment)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-700 dark:text-gray-200">Property costs (repayment + expenses)</dt>
            <dd className="font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">-{money(totalPropertyCost)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-700 dark:text-gray-200">Personal expenses</dt>
            <dd className="font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">-{money(monthlyPersonalExpenses)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-gray-200 dark:border-gray-700 pt-2">
            <dt className="font-bold text-gray-700 dark:text-gray-200">
              Left over
              <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
                {money(totalMonthlyIncome)} in, {money(totalMonthlyCosts)} out - this goes to your offset
              </span>
            </dt>
            <dd className={`font-bold whitespace-nowrap ${monthlyNetBalance < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {signedMoney(monthlyNetBalance)}
            </dd>
          </div>
        </dl>
      </div>

      {/* The three indicators that answer "is this sustainable?" */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
        <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-1">🩺 Can you sustain it?</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Standard rules of thumb, not financial advice. Advanced mode shows the full set of indicators.
        </p>

        {/* TODO-151: the only indicator in Simple mode that needs a tooltip.
            The "Income in" line above shows NET income, but this ratio is
            measured against before-tax income, so a user who divides the two
            figures on screen gets a different number and concludes the app is
            broken - the same mental-math complaint TODO-60's tooltip exists to
            answer. HealthCheckIndicator only renders a tooltip when given
            children, which is why the other two here still have none. */}
        <HealthCheckIndicator
          label="Housing Cost Ratio"
          tooltipLabel="Why doesn't this match my own arithmetic?"
          valueDisplay={`${housingCostRatio.toFixed(0)}%`}
          classification={housingCostRatioClass}
        >
          <p>Measured against your <strong>before-tax</strong> income, not the net figure shown above, because the thresholds are the standard housing-stress benchmark and that benchmark is defined on gross income.</p>
          <p className="mt-2">{money(totalMonthlyIncomeBeforeTax)}/month before tax vs {money(totalMonthlyIncome)}/month net. Advanced mode explains how the two relate.</p>
        </HealthCheckIndicator>
        <HealthCheckIndicator
          label="Interest Rate Stress Test"
          valueDisplay={stressTestDisplay(stressTestSurvivedDelta, alreadyInDeficitAtCurrentRate)}
          classification={stressTestClass}
        />
        <HealthCheckIndicator
          label="Emergency Buffer"
          valueDisplay={bufferDisplay(emergencyBufferMonths, liquidSavings)}
          classification={liquidSavings < 0
            ? { ...emergencyBufferClass, action: bufferShortfallAction(liquidSavings) }
            : emergencyBufferClass}
        />
      </div>

      {/* Nothing entered elsewhere is being ignored - the entry that asked for
          Simple mode was explicit that hidden editors must stay in the model
          and that the user must be able to see they still count. */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-xs space-y-2">
        <p className="font-semibold text-gray-700 dark:text-gray-200">Included in these figures, editable in Advanced:</p>
        <ul className="text-gray-600 dark:text-gray-300 space-y-1">
          <li>{incomeSourceCount} income {incomeSourceCount === 1 ? 'source' : 'sources'}</li>
          <li>{personalExpenseCount} personal {personalExpenseCount === 1 ? 'expense' : 'expenses'}</li>
          <li>{offsetContributionCount} offset {offsetContributionCount === 1 ? 'contribution' : 'contributions'}</li>
          <li>Property expenses, upfront costs, and the projection assumptions (growth rates, vacancy, tax) - all still applied</li>
        </ul>

        {activeAdvancedFeatures.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded p-2">
            <p className="text-amber-800 dark:text-amber-400">
              ⚠️ Advanced settings are shaping these numbers: {activeAdvancedFeatures.join(', ')}. Switch to Advanced to see or change them.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onSwitchToAdvanced}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
        >
          View details in Advanced →
        </button>
      </div>
    </div>
  );
};

export default SimpleModeView;
