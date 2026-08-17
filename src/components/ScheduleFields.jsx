import { useId } from 'react';
import { MAX_MONTH } from '../calculations/recurringAmount';

// Tailwind only keeps classes that appear as complete literal strings in the
// source, so none of these can be built as `bg-${color}-200` - same reason
// NumberSliderField.jsx keeps its own TRACK_CLASSES map. Each call site passes
// a `color` (its card's own hue: the One-Time checkbox and Start Month track)
// plus an `accentColor` (the recurring half: the selected recurrence button
// and the End Month track).
const CHECKBOX_CLASSES = {
  cyan: 'text-cyan-600 dark:text-cyan-400 focus:ring-cyan-500',
  green: 'text-green-600 dark:text-green-400 focus:ring-green-500',
  yellow: 'text-yellow-600 dark:text-yellow-400 focus:ring-yellow-500',
};

const TRACK_CLASSES = {
  blue: 'bg-blue-200 dark:bg-blue-900',
  cyan: 'bg-cyan-200 dark:bg-cyan-900',
  emerald: 'bg-emerald-200 dark:bg-emerald-900',
  green: 'bg-green-200 dark:bg-green-900',
  orange: 'bg-orange-200 dark:bg-orange-900',
  yellow: 'bg-yellow-200 dark:bg-yellow-900',
};

const SELECTED_RECURRENCE_CLASSES = {
  blue: 'bg-blue-200 dark:bg-blue-900 border-blue-400 dark:border-blue-700 font-bold',
  emerald: 'bg-emerald-200 dark:bg-emerald-900 border-emerald-400 dark:border-emerald-700 font-bold',
  orange: 'bg-orange-200 dark:bg-orange-900 border-orange-400 dark:border-orange-700 font-bold',
};

const RECURRENCE_OPTIONS = ['monthly', 'quarterly', 'yearly'];

// TODO-116: the One-Time / Start Month / Monthly-Quarterly-Yearly / End Month
// sub-form, shared by the Income Sources, Offset Contributions and Personal
// Expenses add-forms. `form` is a useScheduleForm() object.
//
// Renders a fragment, NOT a wrapper div, on purpose: all three call sites place
// these fields inside a `space-y-3`/`grid gap-3` column, and both only space
// DIRECT children - a wrapper would collapse separately-spaced fields into one
// flush block.
const ScheduleFields = ({ form, color, accentColor }) => {
  const {
    oneTime, setOneTime,
    startMonth, setStartMonth,
    recurrence, setRecurrence,
    endMonth, setEndMonth,
  } = form;
  const id = useId();

  return (
    <>
      <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
        <input
          type="checkbox"
          checked={oneTime}
          onChange={(e) => setOneTime(e.target.checked)}
          className={`h-4 w-4 rounded border-gray-300 dark:border-gray-600 ${CHECKBOX_CLASSES[color]}`}
        />
        One-Time (occurs once, doesn't repeat)
      </label>

      <div>
        <label htmlFor={`${id}-start`} className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
          {oneTime ? `Occurs at Month: ${startMonth}` : `Start Month: ${startMonth}`}
        </label>
        <input
          id={`${id}-start`}
          type="range" min="1" max={MAX_MONTH}
          value={startMonth}
          onChange={(e) => setStartMonth(Number(e.target.value))}
          className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${TRACK_CLASSES[color]}`}
        />
      </div>

      {!oneTime && (
        <div className="space-y-3">
          <div className="flex gap-2 text-xs">
            {RECURRENCE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRecurrence(option)}
                className={`flex-1 py-1 rounded border capitalize text-gray-800 dark:text-gray-100 ${recurrence === option ? SELECTED_RECURRENCE_CLASSES[accentColor] : 'bg-white dark:bg-gray-800'}`}
              >{option}</button>
            ))}
          </div>

          <div>
            <label htmlFor={`${id}-end`} className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
              End Month: {endMonth === MAX_MONTH ? 'Forever' : endMonth}
            </label>
            <input
              id={`${id}-end`}
              type="range" min={startMonth} max={MAX_MONTH}
              value={endMonth}
              onChange={(e) => setEndMonth(Number(e.target.value))}
              className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${TRACK_CLASSES[accentColor]}`}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ScheduleFields;
