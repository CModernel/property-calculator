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
});
