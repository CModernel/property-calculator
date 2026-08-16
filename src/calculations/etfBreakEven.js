import { calculateLoanWithOffset } from './offsetSimulation';
import { getTimelineSnapshot } from './timelineSnapshot';
import { getComparisonMetric } from './strategyScenarios';

// TODO-138: what annual ETF return would this strategy need for the user to
// end up no worse off than sending every surplus dollar to the offset?
//
// This is the FIRST root-finding helper in src/calculations/ - everything
// else here is a forward calculation - so it stays deliberately small and
// obviously correct rather than clever.
//
// Why bisection is valid, and not just convenient:
//   * offsetSimulation.js writes etfBalance in exactly three places and never
//     READS it on the loan side. So expectedEtfReturn cannot change the
//     payoff month, the offset balance, the interest paid, or anything else.
//     It moves the ETF balance and nothing more.
//   * That makes net worth strictly increasing in the return (the ETF balance
//     is a positive term in it), so there is exactly one crossing point.
//   * It also fixes the comparison horizon: both arms finish where they were
//     always going to finish, whatever return we try. No moving target.
//   * And it means the offset-only arm doesn't depend on the return at all,
//     so it is simulated ONCE, outside the loop.
//
// Deliberately NOT the naive `return x (1 - tax) - mortgage rate` formula from
// popular financial-planning material: that ignores the payoff-date shift, the
// negative-gearing feedback, and the AU 50% CGT discount the engine already
// models properly (offsetSimulation.js's etfMonthlyRate).

// A wide bracket - well past any return a user could defend, so "not found"
// genuinely means "no plausible return rescues this", not "we didn't look".
export const BREAK_EVEN_MAX_RETURN = 50;
const ITERATIONS = 40;

export const BREAK_EVEN_FOUND = 'found';
export const BREAK_EVEN_NEVER_CATCHES_UP = 'neverCatchesUp';
export const BREAK_EVEN_ALREADY_AHEAD = 'alreadyAhead';

// Both arms are compared at the SAME month, and specifically at the EARLIER
// of the two payoff months - normally offset-only's, since diverting surplus
// to an ETF always delays the loan.
//
// Comparing at the LATER month looks more natural and is wrong. Past its own
// payoff, a finished run has no more monthlyData, so getTimelineSnapshot
// clamps it to its final row - which freezes not just its balances but its
// PROPERTY VALUE. Measured on a real fixture, offset-only froze at a property
// value of ~797k while the still-running arm showed ~964k at the same date:
// a ~168k phantom gap that has nothing to do with either strategy, since the
// property appreciates identically either way. That artifact alone was enough
// to report "no return needed at all", which is nonsense.
//
// At the earlier month both arms are genuinely live and mid-flight: the
// diverted one still owes money, and its net worth subtracts that. Nothing is
// frozen or invented. The question it answers is crisp: at the moment the
// safe strategy would have cleared your loan, what return would the ETF have
// needed for you to be equally well off?
function netWorthAt(simulation, month, ctx) {
  const snapshot = getTimelineSnapshot(
    month, simulation.monthlyData, ctx.loanAmount, ctx.monthZeroInterest, ctx.initialSavingsBalance, ctx.initialPropertyValue
  );
  return getComparisonMetric('netWorth').from(snapshot);
}

export function findBreakEvenEtfReturn(baseParams, etfAllocationPct, snapshotContext) {
  // Allocating nothing to the ETF makes the question meaningless - the two
  // arms are the same strategy.
  if (!etfAllocationPct) return null;

  const offsetOnly = calculateLoanWithOffset({ ...baseParams, etfAllocationPct: 0, expectedEtfReturn: 0 });
  const runAt = (expectedEtfReturn) => calculateLoanWithOffset({ ...baseParams, etfAllocationPct, expectedEtfReturn });

  const atZero = runAt(0);
  if (offsetOnly.monthlyData.length === 0 || atZero.monthlyData.length === 0) return null;

  // See netWorthAt above for why this is the EARLIER month, not the later.
  const horizon = Math.min(offsetOnly.months, atZero.months);
  const target = netWorthAt(offsetOnly, horizon, snapshotContext);

  // Edge 1: even with the ETF earning nothing at all, the strategy already
  // matches or beats offset-only. Reporting a rate here would be misleading -
  // there is no threshold to clear.
  if (netWorthAt(atZero, horizon, snapshotContext) >= target) {
    return { outcome: BREAK_EVEN_ALREADY_AHEAD, rate: 0, target, horizon };
  }

  // Edge 2: not even an implausible return closes the gap.
  const atMax = runAt(BREAK_EVEN_MAX_RETURN);
  if (netWorthAt(atMax, horizon, snapshotContext) < target) {
    return { outcome: BREAK_EVEN_NEVER_CATCHES_UP, rate: null, target, horizon };
  }

  let low = 0;
  let high = BREAK_EVEN_MAX_RETURN;
  for (let i = 0; i < ITERATIONS; i++) {
    const mid = (low + high) / 2;
    if (netWorthAt(runAt(mid), horizon, snapshotContext) < target) low = mid;
    else high = mid;
  }
  // Return the upper bound: it is the side of the bracket that actually
  // reaches parity, so quoting it never overstates the strategy.
  return { outcome: BREAK_EVEN_FOUND, rate: high, target, horizon };
}
