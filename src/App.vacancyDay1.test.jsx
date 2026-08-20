// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// TODO-150: Day-1 rental income now applies the same vacancy haircut
// offsetSimulation.js applies from month 1 and resolveProjectedFinancials
// applies to the Stabilized reading. The numeric relationships are pinned in
// the calculation tests (purchaseHealthCheck.scenarios.test.js,
// projectedHealthCheck.test.js, offsetSimulation.test.js); what can ONLY be
// caught here is the pair of render gates that ask "is there rental income?"
// - at the slider's max of 52 weeks the adjusted figure is exactly 0, and a
// gate reading it would silently hide UI for a property that plainly has a
// tenant.

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

async function addHouseRent(user, weeklyAmount) {
  await user.click(screen.getByRole('button', { name: /Income breakdown/ }));
  await user.click(screen.getByRole('button', { name: '+ Add' }));
  await user.selectOptions(screen.getByDisplayValue('Salary/Wages'), 'House Rent');
  fireEvent.change(screen.getByLabelText('Weekly Rent'), { target: { value: String(weeklyAmount) } });
  fireEvent.blur(screen.getByLabelText('Weekly Rent'));
  await user.click(screen.getByRole('button', { name: 'Add Income' }));
}

// The Investment Property checkbox is `disabled={isFirstHomeBuyer}` and the
// shipped default IS a first home buyer, so clicking it directly is a silent
// no-op - the FHB concession has to be given up first (they're mutually
// exclusive by design, see App.mutualExclusionAndUpfront.test.jsx).
async function makeInvestmentProperty(user) {
  await user.click(screen.getByLabelText(/First Home Buyer/));
  await user.click(screen.getByLabelText(/Investment Property/));
}

// Idempotent on purpose: the panel toggle is a toggle, so a second call would
// collapse the panel and lose the slider rather than reopen it.
async function setVacancy(user, weeks) {
  if (!screen.queryByLabelText('Vacancy (weeks/year)')) {
    await user.click(screen.getByRole('button', { name: /Projection assumptions/ }));
  }
  fireEvent.change(screen.getByLabelText('Vacancy (weeks/year)'), { target: { value: String(weeks) } });
  fireEvent.blur(screen.getByLabelText('Vacancy (weeks/year)'));
}

function rentalIncomeRow() {
  return screen.getByText('Monthly Rental Income:').closest('div');
}

describe('Day-1 vacancy haircut (TODO-150)', () => {
  it('the displayed Monthly Rental Income actually moves with the vacancy assumption', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addHouseRent(user, 600);

    // Default is 2 weeks/year: $600/wk * 52/12 * (1 - 2/52) = $2,500.
    expect(within(rentalIncomeRow()).getByText('+$2,500')).toBeInTheDocument();
    expect(within(rentalIncomeRow()).getByText('After 2 weeks/yr vacancy')).toBeInTheDocument();

    await setVacancy(user, 0);
    // Unhaircut: $600 * 52/12 = $2,600.
    expect(within(rentalIncomeRow()).getByText('+$2,600')).toBeInTheDocument();
    expect(within(rentalIncomeRow()).queryByText(/vacancy/)).not.toBeInTheDocument();
  });

  // Both of these gates read the PRE-vacancy figure on purpose. Reading the
  // adjusted one compiles, passes every calculation test, and silently breaks
  // the UI only at the slider's far end - which is exactly why they are pinned.
  it('keeps the Property Summary card visible at 52 weeks vacancy', async () => {
    const user = userEvent.setup();
    render(<App />);
    await addHouseRent(user, 600);
    expect(screen.getByText('📊 Property Summary')).toBeInTheDocument();

    await setVacancy(user, 52);
    expect(within(rentalIncomeRow()).getByText('+$0')).toBeInTheDocument();
    expect(screen.getByText('📊 Property Summary')).toBeInTheDocument();
  });

  it('keeps the Rental Yield indicator reporting a % at 52 weeks vacancy', async () => {
    const user = userEvent.setup();
    render(<App />);
    await makeInvestmentProperty(user);
    await addHouseRent(user, 600);
    await setVacancy(user, 52);

    const heading = screen.getByText('🩺 Purchase Health Check');
    await user.click(within(heading.parentElement).getByRole('button', { name: '▸ Show' }));

    const row = screen.getByText('Rental Yield').closest('div').parentElement;
    expect(within(row).getByText(/3\.7%/)).toBeInTheDocument();
    expect(screen.queryByText(/not enough data yet/)).not.toBeInTheDocument();
  });

  // The locked decision, at the DOM level: yield is quoted before the haircut
  // because its 3%/5% bands are the standard gross benchmark.
  it('leaves Rental Yield unchanged while Housing Cost Ratio moves with vacancy', async () => {
    const user = userEvent.setup();
    render(<App />);
    await makeInvestmentProperty(user);
    await addHouseRent(user, 600);
    await setVacancy(user, 0);

    const heading = screen.getByText('🩺 Purchase Health Check');
    await user.click(within(heading.parentElement).getByRole('button', { name: '▸ Show' }));

    const yieldRow = () => screen.getByText('Rental Yield').closest('div').parentElement;
    const hcrRow = () => screen.getByText('Housing Cost Ratio').closest('div').parentElement;
    const primary = (row) => within(row).getByText((_, node) => node?.className?.includes('font-semibold') && node.tagName === 'SPAN').textContent;

    const yieldAtZero = primary(yieldRow());
    const hcrAtZero = primary(hcrRow());

    // 52 rather than 4 weeks: TODO-151 made Housing Cost Ratio's denominator
    // before-tax, so the rent's share of it shrank and a 4-week haircut no
    // longer always survives rounding to a whole percent. Going to the slider's
    // max drops the rent contribution to zero outright, which keeps this
    // assertion about the behaviour rather than about a rounding boundary. The
    // Rental Yield half is unaffected either way - that's the point of it.
    await setVacancy(user, 52);

    expect(primary(yieldRow())).toBe(yieldAtZero);
    expect(primary(hcrRow())).not.toBe(hcrAtZero);
  });
});
