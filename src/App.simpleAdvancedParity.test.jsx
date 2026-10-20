// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CASES, seedScenario } from './test/healthCheckScenarios';

// Simple mode is a second, shorter reading of the SAME model (TODO-135): every
// figure it shows is computed once in App.jsx and passed down. The three Health
// Check indicators already have a cross-mode check (App.simpleModeStabilized),
// and App.uiMode checks two figures on the shipped default. This covers the
// money lines - what comes in, what goes out, what's left, and the cash to
// settle - on every scenario the Health Check matrix uses, so a figure that
// Simple re-derives (it sums income and costs itself) or formats differently
// can't drift from Advanced unnoticed.

const UI_MODE_KEY = 'propertyCalculator.uiMode';

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

// "+$1,234", "-$1,234" and "$1,234/month" -> a signed whole-dollar number.
function dollars(text) {
  const match = text.match(/([+-]?)\$(-?)([\d,]+)/);
  if (!match) throw new Error(`no dollar figure in "${text}"`);
  const negative = match[1] === '-' || match[2] === '-';
  return (negative ? -1 : 1) * Number(match[3].replace(/,/g, ''));
}

// Simple: a <dt> label (possibly with a grey sub-line) and its <dd> figure.
function simpleRow(label) {
  const dt = [...document.querySelectorAll('dt')].find((node) => node.textContent.startsWith(label));
  if (!dt) throw new Error(`no Simple row "${label}"`);
  return { figure: dt.nextElementSibling.textContent, subLine: dt.querySelector('span')?.textContent ?? '' };
}

// Advanced: a "Label:" next to its figure, the last child of the same flex row.
function advancedFigure(label) {
  return screen.getAllByText(label)[0].parentElement.lastElementChild.textContent;
}

describe('Simple and Advanced show the same money figures (parity)', () => {
  it.each(CASES)('$name', async ({ scenario }) => {
    const user = userEvent.setup();
    await renderSimple(scenario);

    const simple = {
      income: dollars(simpleRow('Income in').figure),
      personal: dollars(simpleRow('Personal expenses').figure),
      leftOver: dollars(simpleRow('Left over').figure),
      cashRequired: dollars(simpleRow('Total cash required').figure),
      cashRemaining: dollars(simpleRow('Cash remaining').figure),
    };
    // "$X in, $Y out - this goes to your offset"
    const [, , out] = simpleRow('Left over').subLine.match(/(.+) in, (.+) out/);
    simple.costs = dollars(out);

    await user.click(screen.getByRole('button', { name: /Advanced mode/ }));

    expect(dollars(advancedFigure('Total Monthly Income:'))).toBe(simple.income);
    expect(dollars(advancedFigure(/Personal Expenses:$/))).toBe(simple.personal);
    expect(dollars(advancedFigure('Total Monthly Expenses:'))).toBe(-simple.costs);
    expect(dollars(advancedFigure('Net Monthly Balance:'))).toBe(simple.leftOver);
    expect(dollars(advancedFigure('Total Cash Required:'))).toBe(simple.cashRequired);
    expect(dollars(advancedFigure('Remaining Savings:'))).toBe(simple.cashRemaining);
  });
});
