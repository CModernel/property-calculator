// offsetSimulation.js's monthlyData only tracks totalPrincipalPaid as a
// running cumulative total (needed for the Timeline Explorer's "so far"
// figures) - the Principal vs. Interest chart needs the per-month split
// instead, so derive it here rather than duplicating the simulation loop.
export function withMonthlyPrincipal(monthlyData) {
  return monthlyData.map((entry, i) => ({
    ...entry,
    monthlyPrincipalPaid: entry.totalPrincipalPaid - (i > 0 ? monthlyData[i - 1].totalPrincipalPaid : 0),
  }));
}

// recharts' `interval="preserveStartEnd"` only guarantees the first/last of
// whichever ticks IT auto-samples get kept - it doesn't guarantee those
// ticks land on year boundaries, so a `month % 12 === 0` formatter can end up
// labelling nothing at all. Passing this explicit list as XAxis's `ticks`
// prop sidesteps recharts' own sampling entirely.
export function getYearTickMonths(totalMonths) {
  if (totalMonths <= 0) return [];
  const ticks = [];
  for (let month = 12; month <= totalMonths; month += 12) ticks.push(month);
  if (ticks[ticks.length - 1] !== totalMonths) ticks.push(totalMonths);
  return ticks;
}
