// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { parseScenarioPayload, serializeScenarioPayload } from './persistence/scenarioStorage';

const STORAGE_KEY = 'propertyCalculator.scenario';

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

// window.location.reload isn't configurable in this jsdom setup (vi.spyOn
// throws "Cannot redefine property") - jsdom doesn't implement navigation
// anyway, so replace the whole `location` object with a stubbed one instead
// of trying to spy on the real one.
function stubLocationReload() {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: vi.fn() },
  });
}

describe('fresh load, no saved scenario', () => {
  it('shows the "not saved yet" banner and no Reset button', () => {
    render(<App />);
    expect(screen.getByText("Your inputs aren't saved yet — they reset if you reload the page.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reset to defaults/ })).not.toBeInTheDocument();
  });
});

describe('Save', () => {
  it('writes a versioned payload to localStorage and flips the banner/Reset button', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '💾 Save' }));

    const saved = parseScenarioPayload(localStorage.getItem(STORAGE_KEY));
    expect(saved).not.toBeNull();
    expect(saved.propertyPrice).toBe(850000);
    expect(saved.incomeSources).toHaveLength(1);
    expect(saved.showEtfInvestingOptions).toBe(false);

    expect(screen.getByText(/💾 Saved/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset to defaults/ })).toBeInTheDocument();
  });

  it('shows an alert and does not flip the banner when localStorage.setItem throws', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    render(<App />);
    await user.click(screen.getByRole('button', { name: '💾 Save' }));

    expect(window.alert).toHaveBeenCalledWith('Could not save - your browser may be blocking local storage (e.g. private browsing).');
    expect(screen.queryByRole('button', { name: /Reset to defaults/ })).not.toBeInTheDocument();
  });
});

describe('Reset to defaults', () => {
  async function saveThenOpenReset(user) {
    render(<App />);
    await user.click(screen.getByRole('button', { name: '💾 Save' }));
    return screen.getByRole('button', { name: /Reset to defaults/ });
  }

  it('does nothing when the confirm dialog is declined', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    stubLocationReload();
    const resetButton = await saveThenOpenReset(user);

    await user.click(resetButton);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('clears the saved scenario and reloads when confirmed', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    stubLocationReload();
    const resetButton = await saveThenOpenReset(user);

    await user.click(resetButton);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(window.location.reload).toHaveBeenCalledOnce();
  });
});

describe('module-load-time localStorage precedence', () => {
  it('a saved scenario wins over config.default.json defaults', async () => {
    localStorage.setItem(STORAGE_KEY, serializeScenarioPayload({ propertyPrice: 611000, incomeSources: [] }));
    vi.resetModules();
    const { default: FreshApp } = await import('./App');
    render(<FreshApp />);

    expect(screen.getByLabelText('Property Price')).toHaveValue(611000);
  });

  it('a mismatched schema version is discarded - defaults load instead', async () => {
    localStorage.setItem(STORAGE_KEY, serializeScenarioPayload({ propertyPrice: 611000, incomeSources: [] }, 1));
    vi.resetModules();
    const { default: FreshApp } = await import('./App');
    render(<FreshApp />);

    expect(screen.getByLabelText('Property Price')).toHaveValue(850000);
    expect(screen.getByText("Your inputs aren't saved yet — they reset if you reload the page.")).toBeInTheDocument();
  });

  it('auto-shows the ETF master for an older saved scenario that already enabled ETF settings', async () => {
    localStorage.setItem(STORAGE_KEY, serializeScenarioPayload({ useEtfInvesting: true, incomeSources: [] }));
    vi.resetModules();
    const { default: FreshApp } = await import('./App');
    render(<FreshApp />);

    expect(screen.getByRole('checkbox', { name: /^Show ETF investing options/ })).toBeChecked();
  });

  it('honors an explicit saved master-off value even when legacy ETF settings are still present', async () => {
    localStorage.setItem(STORAGE_KEY, serializeScenarioPayload({ showEtfInvestingOptions: false, useEtfInvesting: true, incomeSources: [] }));
    vi.resetModules();
    const { default: FreshApp } = await import('./App');
    render(<FreshApp />);

    expect(screen.getByRole('checkbox', { name: /^Show ETF investing options/ })).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: /^Invest in ETFs/ })).not.toBeInTheDocument();
  });
});

// TODO-141 removed the "Realistic Mode" master gate, so the growth/vacancy/tax
// values a scenario stores are now always live. A scenario saved while that
// gate was OFF stored real non-zero rates that were inert at the time - loading
// them as-is would silently change a projection the user had already seen and
// saved, which is exactly what this migration path exists to prevent.
describe('legacy Realistic Mode scenarios (TODO-141)', () => {
  async function renderFreshApp() {
    vi.resetModules();
    const { default: FreshApp } = await import('./App');
    render(<FreshApp />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Projection assumptions/ }));
  }

  it('loads a scenario saved with Realistic Mode OFF as a flat baseline, ignoring its dormant rates', async () => {
    localStorage.setItem(STORAGE_KEY, serializeScenarioPayload({
      realisticModeEnabled: false,
      propertyGrowthRate: 7, salaryGrowthRate: 4, rentGrowthRate: 4,
      expenseGrowthRate: 3, inflationRate: 3, vacancyWeeksPerYear: 5, effectiveTaxRate: 37,
      incomeSources: [],
    }));
    await renderFreshApp();

    for (const label of ['Property Growth Rate', 'Salary Growth Rate', 'Rent Growth Rate', 'Expense Growth Rate', 'Inflation Rate', 'Vacancy (weeks/year)', 'Effective Tax Rate']) {
      expect(screen.getByLabelText(label)).toHaveValue(0);
    }
  });

  it('loads a scenario saved with Realistic Mode ON with its stored rates intact', async () => {
    localStorage.setItem(STORAGE_KEY, serializeScenarioPayload({
      realisticModeEnabled: true,
      propertyGrowthRate: 7, salaryGrowthRate: 4, rentGrowthRate: 4,
      expenseGrowthRate: 3, inflationRate: 3, vacancyWeeksPerYear: 5, effectiveTaxRate: 37,
      incomeSources: [],
    }));
    await renderFreshApp();

    expect(screen.getByLabelText('Property Growth Rate')).toHaveValue(7);
    expect(screen.getByLabelText('Vacancy (weeks/year)')).toHaveValue(5);
    expect(screen.getByLabelText('Effective Tax Rate')).toHaveValue(37);
  });

  it('leaves a brand-new session on the active non-zero defaults', async () => {
    await renderFreshApp();

    expect(screen.getByLabelText('Property Growth Rate')).toHaveValue(5);
    expect(screen.getByLabelText('Effective Tax Rate')).toHaveValue(20);
  });

  it('stops writing the dead realisticModeEnabled flag when a scenario is re-saved', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '💾 Save' }));

    const saved = parseScenarioPayload(localStorage.getItem(STORAGE_KEY));
    expect(saved).not.toHaveProperty('realisticModeEnabled');
  });
});
