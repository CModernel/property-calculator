// TODO-167: the one sanctioned way to ask "can I show these figures to a
// user?" of a calculateLoanWithOffset result.
//
// offsetSimulation.js has an early-out for scenarios where no money moves at
// all, and it returns sentinel figures (years: 999, totalInterest: 999999)
// that look like real money. Three display sites rendered them raw -
// "~$354,814 saved in interest" when the true saving was $204.43,
// "Interest Paid $999,999", "Mortgage-Free Age: 1029" - and a fourth guessed
// at the sentinel numerically and guessed wrong.
//
// Both conditions are checked deliberately, because neither implies the other:
// the flag says the FIGURES (years, totalInterest) came out of the real loop,
// while monthlyData says there is a month-by-month series to read at all -
// which is what getTimelineSnapshot needs, or it returns undefined. A
// maxMonths: 0 run is a genuine projection with real figures and no months in
// it, so it satisfies the flag but not the series.
export function hasUsableProjection(simulation) {
  return simulation.hasUsableProjection === true && simulation.monthlyData.length > 0;
}
