// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CASES, seedScenario } from './test/healthCheckScenarios';

// TODO-163: worseOf(day1, stabilized, direction) picks which of the two
// readings the panel CLASSIFIES, and the classification is what drives the
// badge, the action text, the critical banner and Simple mode. The direction
// argument is the one thing at its six call sites that a typo or a copy-paste
// can flip, and a flipped direction makes a risk indicator report the
// OPTIMISTIC reading with no number on screen looking wrong - the displayed
// value is always Day 1's. Unit tests of worseOf cannot see that; only the
// rendered badge can.
//
// Every case below is a scenario where the two readings fall in DIFFERENT
// classification bands, and the assertion is the badge symbol, which is the
// classification of whichever reading won. Two mutations have to fail, and they
// are different failures:
//   * inverting a direction  - caught by every row below;
//   * deleting worseOf (classifying Day 1 alone) - caught only by the
//     "Stabilized is worse" rows, since in the "better" rows Day 1 already is
//     the worse reading.
// Both were verified by hand against each of the six call sites.
//
// The scenarios are seeded through the saved-scenario storage rather than
// clicked in, so each one is a few lines of numbers instead of a long UI
// script. They are calibrated against the shipped defaults ($850k, $543k loan
// at 6.13%, $1,614/wk salary, 2% vacancy, default growth, $350k savings
// against the default deposit, stamp duty and closing costs) - a change to those
// defaults moves them, and the comment on each row says what it relies on.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  localStorage.clear();
});

async function renderScenario(overrides) {
  seedScenario(overrides);
  vi.resetModules();
  const { default: FreshApp } = await import('./App');
  return render(<FreshApp />);
}

function indicatorRow(label) {
  return screen.getByText(label).closest('div').parentElement;
}

// What the user reads on the right of the row: the classification's symbol next
// to the Day-1 value. The symbol is the part under test.
function badge(label) {
  return indicatorRow(label).querySelector('span.font-semibold').textContent;
}

describe('Health Check classifies the worse of Day 1 and Stabilized (TODO-163)', () => {
  it.each(CASES)('$name', async ({ label, scenario, badge: expectedBadge, arrow }) => {
    await renderScenario(scenario);

    // The symbol is the classification of the WORSE reading; the value beside
    // it is always Day 1's. A flipped direction, or no worseOf at all in the
    // "worse" rows, would put the other band's symbol here.
    expect(badge(label)).toBe(expectedBadge);
    // The arrow and the badge come from the same two readings, through a
    // different function (stabilizedArrow), and the arrows had no rendered
    // coverage at all. Pinning both on the same scenario is what would expose
    // the two functions disagreeing.
    expect(within(indicatorRow(label)).getByText(new RegExp(`^${arrow} stabilizes to`))).toBeInTheDocument();
  });

  // The strongest form of the "Stabilized worse" assertion: not only the
  // symbol but the action text, which is what tells the user to do something.
  it('a Stabilized deficit shows the deficit action, not the Day-1 "survives" one', async () => {
    await renderScenario(CASES.find((c) => c.name === 'Stress Test, Stabilized worse').scenario);
    const row = indicatorRow('Interest Rate Stress Test');
    expect(within(row).getByText(/stabilizes to Already in deficit/)).toBeInTheDocument();
    expect(row.textContent).toMatch(/Already in deficit today/);
  });
});
