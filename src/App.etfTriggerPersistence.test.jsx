// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { serializeScenarioPayload } from './persistence/scenarioStorage';

// TODO-157: the ETF start criterion is a mutually-exclusive radio choice, but
// each option's own value lives in its own state and switching options does not
// clear the others. TODO-144 saved those three RAW values and re-derived the
// criterion on load through a priority chain (`etfStartMonth > 1` beats
// `etfReserveMonths > 0` beats `switchThresholdPct > 0`), which only works if
// at most one is ever non-default. Set a start month, then switch to the loan
// ratio, and both are stored - so the reload applied a criterion the user had
// moved away from and dropped the one they had chosen, running a different
// simulation from the one that was saved.

const STORAGE_KEY = 'propertyCalculator.scenario';

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  localStorage.clear();
});

// Scenario is read from localStorage at module-load time, so each case needs a
// fresh module (same approach as App.bufferShortfall.test.jsx).
async function renderWithScenario(overrides) {
  localStorage.setItem(STORAGE_KEY, serializeScenarioPayload(overrides));
  vi.resetModules();
  const { default: FreshApp } = await import('./App');
  return render(<FreshApp />);
}

async function openEtfSection(user) {
  await user.click(screen.getByRole('button', { name: /ETF settings and strategy comparison/ }));
}

function selectedTrigger() {
  const checked = screen.getAllByRole('radio').filter((r) => r.name === 'etfStartTrigger' && r.checked);
  expect(checked).toHaveLength(1);
  return checked[0];
}

const ETF_ON = { showEtfInvestingOptions: true, useEtfInvesting: true, etfAllocationPct: 20 };

describe('ETF start-criterion persistence (TODO-157)', () => {
  it('restores the criterion that was saved, not the one the priority chain would guess', async () => {
    const user = userEvent.setup();
    // Exactly the trap: a leftover etfStartMonth of 36 from an earlier choice,
    // alongside the loan-ratio criterion the user actually settled on.
    await renderWithScenario({
      ...ETF_ON, etfStartTrigger: 'loanRatio', switchThresholdPct: 20, etfStartMonth: 36,
    });
    await openEtfSection(user);

    // The chain would have returned 'month' here, because 36 > 1 wins.
    expect(selectedTrigger()).toHaveAccessibleName(/loan/i);
  });

  it('still honours a stored "month" criterion when that is genuinely the choice', async () => {
    const user = userEvent.setup();
    await renderWithScenario({
      ...ETF_ON, etfStartTrigger: 'month', etfStartMonth: 36, switchThresholdPct: 20,
    });
    await openEtfSection(user);

    expect(selectedTrigger()).toHaveAccessibleName(/month/i);
  });

  // Scenarios saved before TODO-157 have no etfStartTrigger key at all, and
  // must keep loading exactly as they did - the chain is the fallback, not
  // dead code.
  it('falls back to the priority chain for a scenario saved without the criterion', async () => {
    const user = userEvent.setup();
    await renderWithScenario({ ...ETF_ON, switchThresholdPct: 20 });
    await openEtfSection(user);

    expect(selectedTrigger()).toHaveAccessibleName(/loan/i);
  });

  it('a round trip through the save payload preserves the criterion', async () => {
    const user = userEvent.setup();
    await renderWithScenario({
      ...ETF_ON, etfStartTrigger: 'loanRatio', switchThresholdPct: 20, etfStartMonth: 36,
    });
    await user.click(screen.getByRole('button', { name: /Save/i }));

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const payload = saved.data ?? saved;
    expect(payload.etfStartTrigger).toBe('loanRatio');
    // The raw leftovers are still stored - which is exactly why the criterion
    // itself has to be, rather than inferred back out of them.
    expect(payload.etfStartMonth).toBe(36);
  });
});
