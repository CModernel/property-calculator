import { useState } from 'react';
import { MAX_MONTH } from '../calculations/recurringAmount';
import { validateScheduleRange } from '../calculations/scheduleFormValidation';

// TODO-116: the ephemeral add-form state behind the One-Time / Start Month /
// recurrence / End Month sub-form that Income Sources, Offset Contributions
// and Personal Expenses each kept as their own private set of four useState
// pairs - twelve in App.jsx for one repeated concept. Rendered by
// src/components/ScheduleFields.jsx.
//
// `schedule` below is exactly the shape every Schedule-driven item stores,
// resolved by getActiveAmount/isScheduleActive (src/calculations/
// recurringAmount.js): a one-time item gets recurrence 'none' and NO endMonth
// key at all, rather than an endMonth the simulation would ignore.
//
// None of this is persisted - handleSaveScenario deliberately excludes all of
// it, because it's the state of a form that's gone the moment the item lands.
export function useScheduleForm({ oneTime: initialOneTime = false } = {}) {
  const [oneTime, setOneTime] = useState(initialOneTime);
  const [startMonth, setStartMonth] = useState(1);
  const [recurrence, setRecurrence] = useState('monthly');
  const [endMonth, setEndMonth] = useState(MAX_MONTH);

  const schedule = {
    startMonth,
    recurrence: oneTime ? 'none' : recurrence,
    ...(oneTime ? {} : { endMonth }),
  };

  // Alerts from inside the hook, same as useSteppedValue's addChange - all
  // three add-handlers carried this identical message, and keeping the check
  // and its wording together is the point of extracting it. Returns a boolean
  // so each handler keeps its own validation ORDER (contributions check
  // amount -> range -> duplicate month; income checks name -> amount -> range).
  const validateRange = () => {
    if (validateScheduleRange(oneTime, startMonth, endMonth)) return true;
    alert('Start month must be before end month.');
    return false;
  };

  // Called after a successful add, so the next item starts from a clean form.
  // `overrides` exists for Offset Contributions, which reopens on the month
  // AFTER the last contribution (getNextSuggestion) instead of month 1.
  const reset = (overrides = {}) => {
    setOneTime(overrides.oneTime ?? initialOneTime);
    setStartMonth(overrides.startMonth ?? 1);
    setRecurrence(overrides.recurrence ?? 'monthly');
    setEndMonth(overrides.endMonth ?? MAX_MONTH);
  };

  // Partial by design, and the omissions are meaningful: a caller's defaults
  // only overwrite the fields they actually list, and a caller with no
  // defaults at all changes nothing. See INCOME_CATEGORY_DEFAULTS
  // (src/calculations/incomeCategories.js) - 'Child Support' deliberately
  // omits endMonth so the End Month slider keeps whatever the user chose, and
  // House Rent/Room Rent/Other are absent entirely. startMonth is not
  // accepted: no category has ever wanted to move the month the user picked.
  const applyDefaults = (defaults) => {
    if (!defaults) return;
    if (defaults.oneTime !== undefined) setOneTime(defaults.oneTime);
    if (defaults.recurrence !== undefined) setRecurrence(defaults.recurrence);
    if (defaults.endMonth !== undefined) setEndMonth(defaults.endMonth);
  };

  return {
    oneTime, setOneTime,
    startMonth, setStartMonth,
    recurrence, setRecurrence,
    endMonth, setEndMonth,
    schedule,
    validateRange,
    reset,
    applyDefaults,
  };
}
