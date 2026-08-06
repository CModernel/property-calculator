// @vitest-environment jsdom
import './test/reactTestSetup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

async function openPersonalExpenses(user) {
  await user.click(screen.getByRole('button', { name: /Personal expenses breakdown/ }));
}

// Each of the three "Add" panels (Offset Contributions/Exceptional
// Expenses/Other Expenses) has its own heading immediately followed by a
// "+ Add" button sharing the same flex container - scope through that
// heading rather than a bare "+ Add" query, since all three panels render
// simultaneously once Personal Expenses is expanded.
function sectionContainer(headingText) {
  return screen.getByText(headingText).parentElement;
}

async function openAddForm(user, headingText) {
  await user.click(within(sectionContainer(headingText)).getByRole('button', { name: '+ Add' }));
}

describe('Personal Expenses', () => {
  it('blank name triggers the name alert', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPersonalExpenses(user);
    await openAddForm(user, 'Personal Expenses');

    fireEvent.change(screen.getByPlaceholderText(/Food, Transport, Wedding/), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Add Expense' }));
    expect(window.alert).toHaveBeenLastCalledWith('Please enter a name for the expense.');
  });

  it('amount <= 0 triggers the invalid-amount alert', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPersonalExpenses(user);
    await openAddForm(user, 'Personal Expenses');

    fireEvent.change(screen.getByPlaceholderText(/Food, Transport, Wedding/), { target: { value: 'Gym' } });
    fireEvent.change(screen.getByLabelText('Amount ($)'), { target: { value: '0' } });
    fireEvent.blur(screen.getByLabelText('Amount ($)'));
    await user.click(screen.getByRole('button', { name: 'Add Expense' }));
    expect(window.alert).toHaveBeenLastCalledWith('Please enter a valid amount.');
  });

  it('an inverted schedule range triggers the month-order alert', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPersonalExpenses(user);
    await openAddForm(user, 'Personal Expenses');

    fireEvent.change(screen.getByPlaceholderText(/Food, Transport, Wedding/), { target: { value: 'Gym' } });
    const endSlider = within(screen.getByText(/End Month:/).parentElement).getByRole('slider');
    fireEvent.change(endSlider, { target: { value: '10' } });
    const startSlider = within(screen.getByText(/Start Month:/).parentElement).getByRole('slider');
    fireEvent.change(startSlider, { target: { value: '50' } });

    await user.click(screen.getByRole('button', { name: 'Add Expense' }));
    expect(window.alert).toHaveBeenLastCalledWith('Start month must be before end month.');
  });

  it('a successful add/remove round-trip works', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPersonalExpenses(user);
    await openAddForm(user, 'Personal Expenses');

    fireEvent.change(screen.getByPlaceholderText(/Food, Transport, Wedding/), { target: { value: 'Wedding' } });
    fireEvent.change(screen.getByLabelText('Amount ($)'), { target: { value: '5000' } });
    fireEvent.blur(screen.getByLabelText('Amount ($)'));
    await user.click(screen.getByRole('button', { name: 'Add Expense' }));

    expect(screen.getByText('Wedding')).toBeInTheDocument();
    const row = screen.getByText('Wedding').closest('div').parentElement;
    await user.click(within(row).getByRole('button', { name: '✕' }));
    expect(screen.queryByText('Wedding')).not.toBeInTheDocument();
  });
});

describe('Other Expenses', () => {
  it('selecting Custom reveals the free-text name field; other categories do not', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPersonalExpenses(user);
    await openAddForm(user, 'Other Expenses');

    expect(screen.queryByPlaceholderText('e.g. Pet Expenses, Childcare, Gym')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByDisplayValue('Health'), 'Custom');
    expect(screen.getByPlaceholderText('e.g. Pet Expenses, Childcare, Gym')).toBeInTheDocument();
  });

  it('blank name (Custom with empty text) triggers the name alert', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPersonalExpenses(user);
    await openAddForm(user, 'Other Expenses');
    await user.selectOptions(screen.getByDisplayValue('Health'), 'Custom');

    await user.click(screen.getByRole('button', { name: 'Add Expense' }));
    expect(window.alert).toHaveBeenLastCalledWith('Please enter a name for the expense.');
  });

  it('amount <= 0 triggers the invalid-amount alert', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPersonalExpenses(user);
    await openAddForm(user, 'Other Expenses');

    fireEvent.change(screen.getByLabelText('Amount ($)'), { target: { value: '0' } });
    fireEvent.blur(screen.getByLabelText('Amount ($)'));
    await user.click(screen.getByRole('button', { name: 'Add Expense' }));
    expect(window.alert).toHaveBeenLastCalledWith('Please enter a valid amount.');
  });

  it('an inverted schedule range triggers the month-order alert', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPersonalExpenses(user);
    await openAddForm(user, 'Other Expenses');

    const endSlider = within(screen.getByText(/End Month:/).parentElement).getByRole('slider');
    fireEvent.change(endSlider, { target: { value: '10' } });
    const startSlider = within(screen.getByText(/Start Month:/).parentElement).getByRole('slider');
    fireEvent.change(startSlider, { target: { value: '50' } });

    await user.click(screen.getByRole('button', { name: 'Add Expense' }));
    expect(window.alert).toHaveBeenLastCalledWith('Start month must be before end month.');
  });

  it('a successful add/remove round-trip works', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPersonalExpenses(user);
    await openAddForm(user, 'Other Expenses');

    await user.selectOptions(screen.getByDisplayValue('Health'), 'Subscriptions');
    fireEvent.change(screen.getByLabelText('Amount ($)'), { target: { value: '20' } });
    fireEvent.blur(screen.getByLabelText('Amount ($)'));
    await user.click(screen.getByRole('button', { name: 'Add Expense' }));

    expect(screen.getByText('Subscriptions')).toBeInTheDocument();
    const row = screen.getByText('Subscriptions').closest('div').parentElement;
    await user.click(within(row).getByRole('button', { name: '✕' }));
    expect(screen.queryByText('Subscriptions')).not.toBeInTheDocument();
  });
});

describe('Offset Contributions', () => {
  it('adding with the all-defaults form succeeds and updates the One-Time Contributions Total', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPersonalExpenses(user);
    await openAddForm(user, '💰 Offset Contributions Schedule');
    await user.click(screen.getByRole('button', { name: 'Add Contribution' }));

    expect(screen.getByText(/One-Time Contributions Total:/)).toHaveTextContent('$10,000');
  });

  it('a second one-time contribution manually set to an already-used month triggers the duplicate-month alert', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPersonalExpenses(user);
    await openAddForm(user, '💰 Offset Contributions Schedule');
    await user.click(screen.getByRole('button', { name: 'Add Contribution' })); // month 1, one-time

    await openAddForm(user, '💰 Offset Contributions Schedule');
    // The form auto-suggests month 2 (getNextSuggestion) - manually move it
    // back to month 1, which is already taken by a one-time contribution.
    const startSlider = within(screen.getByText(/Occurs at Month:/).parentElement).getByRole('slider');
    fireEvent.change(startSlider, { target: { value: '1' } });
    await user.click(screen.getByRole('button', { name: 'Add Contribution' }));

    expect(window.alert).toHaveBeenLastCalledWith('A contribution already exists for this month. Please remove it first or choose a different month.');
  });

  it('two independent recurring contributions on the same month do not trigger the duplicate-month alert', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPersonalExpenses(user);

    for (let i = 0; i < 2; i++) {
      await openAddForm(user, '💰 Offset Contributions Schedule');
      await user.click(screen.getByLabelText("One-Time (occurs once, doesn't repeat)")); // uncheck -> recurring
      await user.click(screen.getByRole('button', { name: 'Add Contribution' }));
    }

    expect(window.alert).not.toHaveBeenCalled();
  });

  it('invalid amount silently does nothing (no alert, no row added)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPersonalExpenses(user);
    await openAddForm(user, '💰 Offset Contributions Schedule');

    fireEvent.change(screen.getByLabelText('Amount ($)'), { target: { value: '0' } });
    fireEvent.blur(screen.getByLabelText('Amount ($)'));
    await user.click(screen.getByRole('button', { name: 'Add Contribution' }));

    expect(window.alert).not.toHaveBeenCalled();
    expect(screen.queryByText(/One-Time Contributions Total:/)).toHaveTextContent('$0');
  });

  it('an inverted schedule range triggers the month-order alert', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPersonalExpenses(user);
    await openAddForm(user, '💰 Offset Contributions Schedule');
    await user.click(screen.getByLabelText("One-Time (occurs once, doesn't repeat)")); // uncheck -> reveals End Month

    const endSlider = within(screen.getByText(/End Month:/).parentElement).getByRole('slider');
    fireEvent.change(endSlider, { target: { value: '10' } });
    const startSlider = within(screen.getByText(/Start Month:/).parentElement).getByRole('slider');
    fireEvent.change(startSlider, { target: { value: '50' } });

    await user.click(screen.getByRole('button', { name: 'Add Contribution' }));
    expect(window.alert).toHaveBeenLastCalledWith('Start month must be before end month.');
  });

  it('add/remove round-trip shows the "Plus N recurring contribution(s)" helper text', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPersonalExpenses(user);
    await openAddForm(user, '💰 Offset Contributions Schedule');
    await user.click(screen.getByLabelText("One-Time (occurs once, doesn't repeat)")); // uncheck -> recurring
    await user.click(screen.getByRole('button', { name: 'Add Contribution' }));

    expect(screen.getByText(/Plus 1 recurring contribution - applied/)).toBeInTheDocument();

    // Personal Expenses now ships with 3 seeded items (Groceries/Transport/
    // Phone-Internet, TODO-66), each with their own "✕" - scope to the
    // whole Offset Contributions section (two levels up from its own
    // heading: past the header row, to the section's outer container that
    // also holds the contribution list) rather than a bare "✕" query.
    const offsetSection = screen.getByText('💰 Offset Contributions Schedule').parentElement.parentElement;
    await user.click(within(offsetSection).getByRole('button', { name: '✕' }));
    expect(screen.queryByText(/Plus 1 recurring contribution/)).not.toBeInTheDocument();
  });
});

describe('SteppedExpenseField "Schedule a change" (representative test on Utilities)', () => {
  it('adding a scheduled change shows it in the list; removing it clears the list', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Property expenses breakdown/ }));
    // Interest Rate (Financial Position, TODO-57) is now the first
    // SteppedExpenseField in the whole page, so Utilities - the first one
    // inside Property Expenses when propertyType is 'house' (Strata is
    // hidden entirely in that case) - is index 1, not 0.
    await user.click(screen.getAllByRole('button', { name: '+ Schedule a change' })[1]);

    // "New amount"'s label isn't htmlFor-linked - scope to its form container
    // (a sibling of the "Starting month" label) and use the implicit
    // "spinbutton" role for the lone number input in that small form.
    const scheduleForm = screen.getByText('New amount').closest('div').parentElement;
    const newAmountInput = within(scheduleForm).getByRole('spinbutton');
    fireEvent.change(newAmountInput, { target: { value: '300' } });
    const monthSlider = within(screen.getByText(/Starting month:/).parentElement).getByRole('slider');
    fireEvent.change(monthSlider, { target: { value: '13' } });
    await user.click(screen.getByRole('button', { name: 'Add scheduled change' }));

    expect(screen.getByText('$300 from month 13')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '✕' }));
    expect(screen.queryByText('$300 from month 13')).not.toBeInTheDocument();
  });
});
