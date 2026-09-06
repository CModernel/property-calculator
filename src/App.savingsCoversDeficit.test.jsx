// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { serializeScenarioPayload } from './persistence/scenarioStorage';

const STORAGE_KEY = 'propertyCalculator.scenario';

// TODO-170: the engine used to cover a deficit month from the offset alone and
// report the rest as money the user doesn't have - while the savings balance it
// was seeded with sat untouched and fully visible on the same screen. One page
// said "⚠️ Cash shortfall: $45,616 ... the figures below assume money you don't
// have" and "🐖 Savings: $28,453" at once, and the Purchase Health Check called
// it a 🟢 6.3-month emergency buffer.
//
// These render tests exist because the whole change is invisible to the
// calculation suite: every pre-existing shortfall test runs with
// initialSavingsBalance at 0, so none of them can tell the two behaviours apart.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

// The scenario has to reach the app through storage rather than through the UI:
// a $60,000 one-off is far quicker to inject than to type, and the shipped
// default's own cashRemaining ($28,453) is exactly the savings figure the TODO
// reproduced against.
async function renderWith(scenario) {
  localStorage.setItem(STORAGE_KEY, serializeScenarioPayload(scenario));
  vi.resetModules();
  const { default: FreshApp } = await import('./App');
  render(<FreshApp />);
}

const SALARY = { id: 1, name: 'Salary/Wages', amount: 1614, startMonth: 1, recurrence: 'monthly', endMonth: 360 };

function moneyFrom(text) {
  return Number(text.match(/\$([\d,]+)/)[1].replace(/,/g, ''));
}

describe('A deficit spends savings before anything is called a shortfall (TODO-170)', () => {
  it('the reported shortfall and the on-screen savings no longer contradict each other', async () => {
    // TODO-170's own repro, exactly: the shipped default's three personal
    // expenses plus one $60,000 one-off at month 6.
    await renderWith({
      incomeSources: [SALARY],
      personalExpenseItems: [
        { id: 1, name: 'Groceries', amount: 433, startMonth: 1, recurrence: 'monthly', endMonth: 360 },
        { id: 2, name: 'Transport', amount: 217, startMonth: 1, recurrence: 'monthly', endMonth: 360 },
        { id: 3, name: 'Phone/Internet', amount: 30, startMonth: 1, recurrence: 'monthly', endMonth: 360 },
        { id: 4, name: 'Custom', customName: 'Car', amount: 60000, startMonth: 6, recurrence: 'none', endMonth: 6 },
      ],
    });

    // $45,616 before the fix. The shipped default's cashRemaining is $28,453,
    // and 45,616 - 28,453 = 17,163 - the figure TODO-170 named as the
    // genuinely unfunded amount. The savings the plan spends is the whole
    // balance, so the two figures now account for the deficit between them
    // instead of the shortfall claiming all of it.
    expect(moneyFrom(screen.getByText(/⚠️ Cash shortfall:/).textContent)).toBe(17_163);
    expect(moneyFrom(screen.getByText(/🐖 Savings used:/).textContent)).toBe(28_453);

    // And the contradiction itself is gone: at the month the money was spent,
    // the Timeline Explorer no longer shows it still sitting there. This is
    // the assertion that fails loudest on a revert - the old build renders
    // "🐖 Savings: $28,453" beside a $45,616 shortfall.
    fireEvent.change(screen.getByLabelText('Viewing month'), { target: { value: '6' } });
    expect(moneyFrom(screen.getByText(/🐖 Savings: \$/).textContent)).toBe(0);
  });

  it('surfaces the drawdown even when savings absorbs the whole deficit and no shortfall survives', async () => {
    // The case that would otherwise slip through silently, and the reason the
    // disclosure is not gated on a surviving shortfall. TODO-145 declined ETF
    // liquidation partly because it "makes the model MORE optimistic than
    // today ... silently changing every existing scenario" - the same objection
    // applies here, and this banner is the answer to it.
    await renderWith({
      incomeSources: [SALARY],
      personalExpenseItems: [
        { id: 1, name: 'Groceries', amount: 433, startMonth: 1, recurrence: 'monthly', endMonth: 360 },
        { id: 2, name: 'Custom', customName: 'Car', amount: 20000, startMonth: 6, recurrence: 'none', endMonth: 6 },
      ],
    });

    expect(screen.queryByText(/⚠️ Cash shortfall:/)).not.toBeInTheDocument();
    expect(screen.getByText(/🐖 Savings used:/)).toBeInTheDocument();
  });

  it('says nothing at all about savings for a scenario that never runs a deficit', async () => {
    await renderWith({ incomeSources: [SALARY] });

    expect(screen.queryByText(/⚠️ Cash shortfall:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/🐖 Savings used:/)).not.toBeInTheDocument();
  });
});
