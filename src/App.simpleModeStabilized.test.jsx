// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CASES, seedScenario } from './test/healthCheckScenarios';

// TODO-160: Simple mode showed a Day-1 VALUE next to a classification of the
// WORSE of Day 1 and Stabilized, and explained neither - so a number the app's
// own band table calls fine could sit under a red badge, or "Survives +3%"
// above "Already in deficit today...". Advanced always rendered a "stabilizes
// to" note; Simple now renders the same note, composed once in App.jsx, with the
// month it refers to (Simple has no tooltip on these rows to say so).
//
// The scenarios are the ones App.worseOfDirection.test.jsx pins for Advanced,
// shared through test/healthCheckScenarios.js.

const UI_MODE_KEY = 'propertyCalculator.uiMode';
const SHARED = ['Emergency Buffer', 'Housing Cost Ratio', 'Interest Rate Stress Test'];
const SHARED_CASES = CASES.filter((c) => SHARED.includes(c.label));

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  localStorage.clear();
});

async function renderSimple(scenario) {
  seedScenario(scenario);
  localStorage.setItem(UI_MODE_KEY, 'simple');
  vi.resetModules();
  const { default: FreshApp } = await import('./App');
  return render(<FreshApp />);
}

function indicatorRow(label) {
  return screen.getByText(label).closest('div').parentElement;
}
const badge = (label) => indicatorRow(label).querySelector('span.font-semibold').textContent;
// The grey "↘ stabilizes to ..." line, whichever mode rendered it.
const note = (label) => within(indicatorRow(label)).getByText(/stabilizes to/).textContent;

describe('Simple mode explains the Stabilized reading behind its badges (TODO-160)', () => {
  it.each(SHARED_CASES)('$name', async ({ label, scenario, badge: expectedBadge, arrow }) => {
    await renderSimple(scenario);

    // Same classification as Advanced pins - the badge was never the problem;
    // the problem was a badge with nothing on screen that could explain it.
    expect(badge(label)).toBe(expectedBadge);
    expect(note(label)).toMatch(new RegExp(`^${arrow} stabilizes to .+ \\(month \\d+\\)$`));
  });

  // The ticket's own symptom: the number reads fine, the badge is red, and the
  // only thing that reconciles them is the note.
  it('reads "stabilizes to Already in deficit" under a red badge on a Survives +3% value', async () => {
    const { scenario } = CASES.find((c) => c.name === 'Stress Test, Stabilized worse');
    await renderSimple(scenario);

    expect(badge('Interest Rate Stress Test')).toBe('🔴 Survives +3%');
    expect(note('Interest Rate Stress Test')).toBe('↘ stabilizes to Already in deficit (month 24)');
    expect(indicatorRow('Interest Rate Stress Test').textContent).toMatch(/Already in deficit today/);
  });

  it('names the month the reading refers to', async () => {
    const { scenario } = CASES.find((c) => c.name === 'Housing Cost Ratio, Stabilized worse');
    await renderSimple(scenario);
    expect(note('Housing Cost Ratio')).toBe('↘ stabilizes to 52% (month 2)');
  });

  // Parity by construction is the design (one string composed in App.jsx), and
  // this is what would catch someone re-composing it inside Simple with a
  // different direction literal: for every shared case, flipping to Advanced
  // shows the same badge and the same note, bar the month Simple appends.
  it.each(SHARED_CASES)('agrees with Advanced: $name', async ({ label, scenario }) => {
    const user = userEvent.setup();
    await renderSimple(scenario);
    const simpleBadge = badge(label);
    const simpleNote = note(label).replace(/ \(month \d+\)$/, '');

    await user.click(screen.getByRole('button', { name: /Advanced mode/ }));

    expect(badge(label)).toBe(simpleBadge);
    expect(note(label)).toBe(simpleNote);
  });
});
