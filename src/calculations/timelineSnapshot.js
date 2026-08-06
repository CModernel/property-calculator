import { safePercentage } from './safePercentage';

// Month 0 is a synthetic "nothing has happened yet" snapshot -
// offsetSimulation.js's loop starts counting at month 1, so month 0 never
// appears in monthlyData. Past the simulation's last recorded month, fall
// back to that last month rather than returning nothing.
export function getTimelineSnapshot(timelineMonth, monthlyData, loanAmount, monthZeroInterest, initialSavingsBalance = 0, initialPropertyValue = 0) {
  if (timelineMonth === 0) {
    return {
      balance: loanAmount,
      offset: 0,
      // TODO-49/80: mirrors offsetSimulation.js's own initialSavingsBalance -
      // the actual cash sitting in the bank (cashRemaining) before any
      // monthly surplus has been split, same "nothing has happened yet"
      // convention as the rest of this synthetic snapshot.
      savings: Math.round(initialSavingsBalance),
      effectiveBalance: loanAmount,
      monthlyInterestPaid: Math.round(monthZeroInterest),
      totalInterestPaid: 0,
      totalPrincipalPaid: 0,
      // TODO-89: mirrors offsetSimulation.js's own propertyValue - nothing
      // has grown yet at month 0, so it's just the purchase price.
      propertyValue: Math.round(initialPropertyValue),
    };
  }
  return monthlyData.find(d => d.month === timelineMonth) || monthlyData[monthlyData.length - 1];
}

// No loan at all means the property is owned outright, so the bar is full.
export function calculateEffectiveProgress(loanAmount, effectiveBalance) {
  return Math.min(100, safePercentage(loanAmount - effectiveBalance, loanAmount, 100));
}

export function calculateTimeRemaining(totalMonths, timelineMonth) {
  const monthsRemaining = Math.max(0, totalMonths - timelineMonth);
  return { years: Math.floor(monthsRemaining / 12), months: monthsRemaining % 12 };
}
