// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { serializeScenarioPayload } from './persistence/scenarioStorage';

const STORAGE_KEY = 'propertyCalculator.scenario';

// TODO-171: the engine has credited a monthly negative-gearing tax benefit
// directly into the offset since TODO-129 - accelerating payoff and cutting
// total interest - with totalNegativeGearingBenefit rendered NOWHERE
// (grepped: zero occurrences in any .jsx before this fix) and the Investment
// Property checkbox's own explainer saying only "Adds Land Tax and Property
// Management to Property Expenses." These tests exist because that whole
// effect was invisible to the render suite: nothing anywhere asserted on
// this figure or its wording.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

async function renderWith(scenario) {
  localStorage.setItem(STORAGE_KEY, serializeScenarioPayload(scenario));
  vi.resetModules();
  const { default: FreshApp } = await import('./App');
  render(<FreshApp />);
}

const GEARING_SCENARIO = {
  isFirstHomeBuyer: false,
  isInvestmentProperty: true,
  effectiveTaxRate: 45,
  loanAmount: 765000,
  purchasePrice: 850000,
  interestRate: 8,
  incomeSources: [
    { id: 1, name: 'Salary/Wages', amount: 2200, startMonth: 1, recurrence: 'monthly', endMonth: 360, isGross: true },
    { id: 2, name: 'House Rent', amount: 500, startMonth: 1, recurrence: 'monthly', endMonth: 360 },
  ],
};

function moneyFrom(text) {
  return Number(text.match(/\$([\d,]+)/)[1].replace(/,/g, ''));
}

describe('Negative gearing tax relief disclosure (TODO-171)', () => {
  it('discloses the total benefit and its effect on payoff/interest, once totalNegativeGearingBenefit is real', async () => {
    await renderWith(GEARING_SCENARIO);

    const headline = screen.getByText('Negative gearing tax relief:').parentElement;
    // Before this fix, totalNegativeGearingBenefit had no UI consumer at all -
    // this is the first assertion on it anywhere in the render suite.
    expect(moneyFrom(headline.textContent)).toBeGreaterThan(0);
    expect(screen.getByText(/Without it, paying off would take/)).toBeInTheDocument();
    expect(screen.getByText(/longer and cost ~\$[\d,]+ more in interest/)).toBeInTheDocument();
  });

  it('names the difference from the Gearing indicator, so the two do not read as contradicting each other', async () => {
    await renderWith(GEARING_SCENARIO);
    expect(screen.getByText(/Different from the Gearing indicator below/)).toBeInTheDocument();
  });

  it('says nothing when the property is not negatively geared for tax purposes, even with Investment Property ticked', async () => {
    // Large rent, no expenses beyond the loan itself - cash-flow positive,
    // so totalNegativeGearingBenefit stays exactly 0 and the tile must not
    // render an empty/zero line.
    await renderWith({
      ...GEARING_SCENARIO,
      incomeSources: [
        { id: 1, name: 'House Rent', amount: 2000, startMonth: 1, recurrence: 'monthly', endMonth: 360 },
      ],
    });
    expect(screen.queryByText('Negative gearing tax relief:')).not.toBeInTheDocument();
  });

  it('says nothing when Investment Property is unticked, even if the numbers would otherwise qualify', async () => {
    await renderWith({ ...GEARING_SCENARIO, isInvestmentProperty: false });
    expect(screen.queryByText('Negative gearing tax relief:')).not.toBeInTheDocument();
  });

  it('extends the checkbox explainer to mention the tax relief, not just Land Tax/Property Management', async () => {
    await renderWith(GEARING_SCENARIO);
    expect(screen.getByText(/models tax relief on rental losses \(negative gearing\)/)).toBeInTheDocument();
    // Confirms the <label> itself was left untouched - several other tests
    // depend on this exact accessible name.
    expect(screen.getByLabelText('Investment Property')).toBeInTheDocument();
  });
});
