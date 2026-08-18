// The flat, deterministic haircut applied to House Rent/Room Rent income to
// account for expected vacancy - an annualized average spread evenly across
// every month, not a simulated run of empty weeks (TODO-95).
//
// Deliberately NOT clamped. `vacancyWeeksPerYear > 52` drives this negative,
// which reduces rather than zeroes the surplus - pinned by
// offsetSimulation.test.js's 'vacancy weeks beyond a full year' case. The UI
// slider clamps to [0, 52] on its own (NumberSliderField), so in the app the
// factor is always in [0, 1]; 52 weeks means "never rented" and yields exactly
// 0, which is why callers that need the pre-vacancy figure must keep it around
// rather than dividing this back out.
export function calculateVacancyFactor(vacancyWeeksPerYear) {
  return 1 - (vacancyWeeksPerYear / 52);
}
