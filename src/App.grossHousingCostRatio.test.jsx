// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// TODO-151: Housing Cost Ratio is measured against BEFORE-TAX income, because
// its 30/40/50 thresholds are the standard housing-stress benchmark and that
// benchmark - like any lender's serviceability assessment - is defined on gross
// income. The numeric relationships are pinned in the calculation tests
// (grossIncome.test.js, purchaseHealthCheck.scenarios.test.js,
// projectedHealthCheck.test.js); what this file covers is what the user
// actually sees, plus two things only reachable through a render.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

async function openHealthCheck(user) {
  const heading = screen.getByText('🩺 Purchase Health Check');
  await user.click(within(heading.parentElement).getByRole('button', { name: '▸ Show' }));
}

function hcrRow() {
  return screen.getByText('Housing Cost Ratio').closest('div').parentElement;
}

function primaryValue(row) {
  return within(row).getByText((_, node) => node?.className?.includes('font-semibold') && node.tagName === 'SPAN').textContent;
}

async function setTaxRate(user, rate) {
  if (!screen.queryByLabelText('Effective Tax Rate')) {
    await user.click(screen.getByRole('button', { name: /Projection assumptions/ }));
  }
  fireEvent.change(screen.getByLabelText('Effective Tax Rate'), { target: { value: String(rate) } });
  fireEvent.blur(screen.getByLabelText('Effective Tax Rate'));
}

describe('Housing Cost Ratio on before-tax income (TODO-151)', () => {
  // The symptom that opened the TODO: out of the box the indicator screamed red
  // while the scenario ran a +$2,470/month surplus. 44% is Caution, not green -
  // 44% of gross on housing genuinely is caution territory - but it is no
  // longer a false alarm.
  it('reads 44% Caution on the shipped default instead of 55% High risk', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openHealthCheck(user);

    expect(primaryValue(hcrRow())).toBe('🟠 44%');
    expect(within(hcrRow()).getByText(/Housing is a large share of income/)).toBeInTheDocument();
  });

  it('falls back to the net figure at a 0% tax rate, exactly as before the change', async () => {
    const user = userEvent.setup();
    render(<App />);
    await setTaxRate(user, 0);
    await openHealthCheck(user);

    expect(primaryValue(hcrRow())).toBe('🔴 55%');
  });

  // Counterintuitive but correct: a higher assumed rate implies a bigger gross
  // salary behind the same take-home. The Effective Tax Rate slider stays
  // coloured "higher = worse" (TODO-139) because that is about cash flow, and
  // the slider's own tooltip now explains this interaction.
  it('improves as the assumed tax rate rises, since the implied gross salary grows', async () => {
    const user = userEvent.setup();
    render(<App />);
    await setTaxRate(user, 40);
    await openHealthCheck(user);

    expect(primaryValue(hcrRow())).toBe('🟢 33%');
  });

  // The original ticket's own acceptance criterion: "Whichever wins, the
  // Stabilized reading (TODO-134) must use the same convention as Day 1."
  // Added on review of PCALC-100, which wired it but never asserted it - the
  // only thing standing on that wiring was an incidental symbol change in the
  // 40%-rate test below, via worseOf(); the Stabilized VALUE was unasserted, so
  // reverting the denominator to net went unnoticed on the default scenario.
  describe('the Stabilized reading uses the same before-tax convention', () => {
    function stabilizedText() {
      return within(hcrRow()).getByText(/stabilizes to/).textContent;
    }

    it('annotates a before-tax Stabilized figure, not the net one', async () => {
      const user = userEvent.setup();
      render(<App />);
      await openHealthCheck(user);

      // Net would read 48%; before-tax at the default 20% is 0.8x that.
      expect(stabilizedText()).toContain('stabilizes to 39%');
    });

    it('moves the Stabilized figure with the tax rate, exactly as Day-1 moves', async () => {
      const user = userEvent.setup();
      render(<App />);
      await openHealthCheck(user);
      const atDefault = stabilizedText();

      await setTaxRate(user, 0);
      const atZero = stabilizedText();

      // At 0% the gross-up is a no-op, so this must read the net figure - and
      // must differ from the grossed-up one, which is what proves the
      // Stabilized denominator is wired to the before-tax fields at all.
      expect(atZero).toContain('stabilizes to 48%');
      expect(atZero).not.toBe(atDefault);
    });
  });

  // Only reachable through a render: the tooltip has to reconcile the two
  // figures on screen, or a user who divides them concludes the app is broken.
  it('shows both the net and before-tax figures in its tooltip', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openHealthCheck(user);

    const tooltip = within(hcrRow()).getByRole('tooltip');
    expect(tooltip).toHaveTextContent('$6,994/month of net income counts as $8,743');
    expect(tooltip).toHaveTextContent('grossed up at your 20% Effective Tax Rate');
    // The locked decision, in the copy: income with no withholding is never
    // grossed up, so the tooltip must not promise otherwise.
    expect(tooltip).toHaveTextContent(/counted exactly as entered, never grossed up/);
  });

  // Pinned so nobody later "notices" the banner and reverts the fix: it is
  // driven independently by the lost FHB stamp-duty concession, NOT by Housing
  // Cost Ratio, so it correctly survives this change on the default scenario.
  it('keeps the critical banner, which the FHB concession drives rather than this indicator', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openHealthCheck(user);

    expect(screen.getByText(/One or more indicators below need attention/)).toBeInTheDocument();
    expect(primaryValue(hcrRow())).toBe('🟠 44%');
  });

  it('explains the gross-vs-net gap in Simple mode too, where only net income is on screen', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Simple mode/ }));

    expect(primaryValue(hcrRow())).toBe('🟠 44%');
    expect(within(hcrRow()).getByRole('tooltip')).toHaveTextContent('$8,743/month before tax vs $6,994/month net');
  });
});
