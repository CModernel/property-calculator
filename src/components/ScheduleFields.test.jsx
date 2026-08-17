// @vitest-environment jsdom
import '../test/reactTestSetup';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ScheduleFields from './ScheduleFields';
import { MAX_MONTH } from '../calculations/recurringAmount';

// Mirrors useScheduleForm's return shape with spy setters, same approach as
// SteppedExpenseField.test.jsx's makeField - the component can then be checked
// in isolation from the real hook.
function makeForm(overrides = {}) {
  return {
    oneTime: false,
    setOneTime: vi.fn(),
    startMonth: 1,
    setStartMonth: vi.fn(),
    recurrence: 'monthly',
    setRecurrence: vi.fn(),
    endMonth: MAX_MONTH,
    setEndMonth: vi.fn(),
    ...overrides,
  };
}

const renderFields = (form) =>
  render(<ScheduleFields form={form} color="green" accentColor="emerald" />);

describe('ScheduleFields', () => {
  it('renders its fields as siblings, with no wrapper element', () => {
    // Every call site spaces these with `space-y-3`/`grid gap-3`, which only
    // apply to DIRECT children - a wrapper div would collapse the gaps, and
    // nothing else in the suite would catch that.
    const { container } = renderFields(makeForm());
    expect(container.children).toHaveLength(3);
  });

  it('the One-Time checkbox is reachable by its exact label text', () => {
    const form = makeForm();
    renderFields(form);
    const checkbox = screen.getByLabelText("One-Time (occurs once, doesn't repeat)");
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(form.setOneTime).toHaveBeenCalledWith(true);
  });

  it('the Start Month label and its slider share one wrapper', () => {
    // This is the exact query shape the App-level tests use; keep it working.
    const form = makeForm({ startMonth: 12 });
    renderFields(form);
    const slider = within(screen.getByText('Start Month: 12').parentElement).getByRole('slider');
    fireEvent.change(slider, { target: { value: '30' } });
    expect(form.setStartMonth).toHaveBeenCalledWith(30);
  });

  it('one-time mode relabels the month and hides the recurring controls', () => {
    renderFields(makeForm({ oneTime: true, startMonth: 5 }));
    expect(screen.getByText('Occurs at Month: 5')).toBeInTheDocument();
    expect(screen.queryByText(/Start Month:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/End Month:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'monthly' })).not.toBeInTheDocument();
  });

  it('End Month reads "Forever" at MAX_MONTH and the number otherwise', () => {
    const { unmount } = renderFields(makeForm());
    expect(screen.getByText('End Month: Forever')).toBeInTheDocument();
    unmount();
    renderFields(makeForm({ endMonth: 24 }));
    expect(screen.getByText('End Month: 24')).toBeInTheDocument();
  });

  it('picking a recurrence reports it, and the End Month slider starts at Start Month', () => {
    const form = makeForm({ startMonth: 8 });
    renderFields(form);
    fireEvent.click(screen.getByRole('button', { name: 'quarterly' }));
    expect(form.setRecurrence).toHaveBeenCalledWith('quarterly');
    const endSlider = within(screen.getByText(/End Month:/).parentElement).getByRole('slider');
    expect(endSlider).toHaveAttribute('min', '8');
  });

  it('maps colour props onto real literal Tailwind classes', () => {
    // Guards the lookup maps: a missing key would silently render an
    // undefined class instead of the card's colour.
    render(<ScheduleFields form={makeForm()} color="yellow" accentColor="orange" />);
    const startSlider = within(screen.getByText(/Start Month:/).parentElement).getByRole('slider');
    expect(startSlider).toHaveClass('bg-yellow-200', 'dark:bg-yellow-900');
    const endSlider = within(screen.getByText(/End Month:/).parentElement).getByRole('slider');
    expect(endSlider).toHaveClass('bg-orange-200', 'dark:bg-orange-900');
    expect(screen.getByRole('button', { name: 'monthly' })).toHaveClass('bg-orange-200');
    expect(screen.getByLabelText("One-Time (occurs once, doesn't repeat)")).toHaveClass('text-yellow-600');
  });
});
