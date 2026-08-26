// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { serializeScenarioPayload } from './persistence/scenarioStorage';

// TODO-149: calculateEmergencyBufferMonths/calculateVacancyBufferMonths keep
// dividing liquidSavings by monthly outgoings unclamped (deliberately - the
// calculation itself is pinned unchanged in purchaseHealthCheck.scenarios.test.js's
// propertyPrice: 1200000 row, still -1.5/"High risk"). This tests the display
// layer only: liquidSavings < 0 must read "Can't cover settlement", not a
// negative month count.

const STORAGE_KEY = 'propertyCalculator.scenario';

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

// Scenario is read from localStorage at module-load time (see
// App.persistence.test.jsx's "module-load-time localStorage precedence"
// describe block) - setting it before an already-imported <App/> renders is
// a no-op, so each scenario needs a fresh module via resetModules()+import.
async function renderWithScenario(overrides) {
  localStorage.setItem(STORAGE_KEY, serializeScenarioPayload(overrides));
  vi.resetModules();
  const { default: FreshApp } = await import('./App');
  return render(<FreshApp />);
}

async function openHealthCheck(user) {
  const heading = screen.getByText('🩺 Purchase Health Check');
  const toggle = within(heading.parentElement).getByRole('button', { name: '▸ Show' });
  await user.click(toggle);
}

function indicatorRow(label) {
  return screen.getByText(label).closest('div').parentElement;
}

function primaryValue(row) {
  return within(row).getByText((_, node) => node?.className?.includes('font-semibold') && node.tagName === 'SPAN').textContent;
}

describe('Emergency/Vacancy Buffer settlement-shortfall display (TODO-149)', () => {
  it('Emergency Buffer shows "Can\'t cover settlement" when liquidSavings is negative', async () => {
    const user = userEvent.setup();
    // TODO-147's matrix pins this exact scenario: liquidSavings -$9,937,
    // emergencyBufferMonths -1.5, still classified High risk.
    await renderWithScenario({ propertyPrice: 1200000 });
    await openHealthCheck(user);

    const row = indicatorRow('Emergency Buffer');
    expect(primaryValue(row)).toBe("🔴 Can't cover settlement");
    expect(within(row).getByText(/Short by \$9,937 at settlement/)).toBeInTheDocument();
  });

  it('Vacancy Buffer shows "Can\'t cover settlement" too - it shares the same liquidSavings numerator', async () => {
    const user = userEvent.setup();
    await renderWithScenario({ propertyPrice: 1200000, isInvestmentProperty: true });
    await openHealthCheck(user);

    const row = indicatorRow('Vacancy Buffer');
    expect(primaryValue(row)).toBe("🔴 Can't cover settlement");
  });

  it('reads "0.0 months" (not the shortfall wording) exactly at the liquidSavings === 0 boundary', async () => {
    const user = userEvent.setup();
    // Verified against the real calculation: config.default.json's
    // totalCashRequired is $321,546.75, so totalSavings set to that exact
    // figure makes liquidSavings exactly 0.
    await renderWithScenario({ totalSavings: 321546.75 });
    await openHealthCheck(user);

    const row = indicatorRow('Emergency Buffer');
    expect(primaryValue(row)).toBe('🔴 0.0 months');
    expect(within(row).queryByText(/Can't cover settlement/)).not.toBeInTheDocument();
  });

  // TODO-156: the third display site. It kept its own inline copy of the
  // wording and its call site never passed liquidSavings, so it still printed
  // "-1.5 months (High risk)" next to advice to fund the buffer before buying
  // ETFs. Nothing pinned it because the only cross-site test in the suite
  // (App.projectionAssumptions) runs the default, funded scenario.
  it('the risk-tolerance panel agrees with the Health Check panel on a settlement shortfall', async () => {
    const user = userEvent.setup();
    await renderWithScenario({
      propertyPrice: 1200000, showEtfInvestingOptions: true, useEtfInvesting: true, etfAllocationPct: 20,
    });

    // The scenario turns the ETF feature on; the expander is plain UI state,
    // so it still has to be opened before the panel is reachable.
    await user.click(screen.getByRole('button', { name: /ETF settings and strategy comparison/ }));

    const riskPanel = screen.getByText('🧭 Risk-tolerance reference points').closest('div');
    expect(within(riskPanel).getByText(/Can't cover settlement \(High risk\)/)).toBeInTheDocument();
    expect(within(riskPanel).queryByText(/-1\.5 months/)).not.toBeInTheDocument();

    // ...and the Health Check panel says the same thing for the same scenario.
    await openHealthCheck(user);
    expect(primaryValue(indicatorRow('Emergency Buffer'))).toBe("🔴 Can't cover settlement");
  });

  it('Simple mode shows the same "Can\'t cover settlement" wording for Emergency Buffer', async () => {
    const user = userEvent.setup();
    await renderWithScenario({ propertyPrice: 1200000 });
    await user.click(screen.getByRole('button', { name: /Simple mode/ }));

    const row = indicatorRow('Emergency Buffer');
    expect(primaryValue(row)).toBe("🔴 Can't cover settlement");
  });
});
