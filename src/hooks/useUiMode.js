import { useState, useEffect } from 'react';

const STORAGE_KEY = 'propertyCalculator.uiMode';

export const UI_MODES = { simple: 'simple', advanced: 'advanced' };

// TODO-135: which interface complexity the user sees. Deliberately NOT part of
// the saved scenario, and deliberately in its own localStorage key, same as
// useDarkMode's theme - loading a scenario must never change how complex the
// interface is (TODO-135 item 4), and the preference must survive "Reset to
// defaults", which only clears the scenario key.
//
// This diverges from the larger half of an inconsistent precedent on purpose:
// 15 `show*` collapse flags ARE saved into the scenario payload (see
// handleSaveScenario in App.jsx), even though that payload's own comment claims
// collapsed sections aren't. This follows the dark-mode/comparisonMetric side
// of that split instead - don't "fix" it into the payload.
//
// Advanced is the default: it's today's whole interface, so neither an existing
// user nor a saved scenario ever silently loses controls, which keeps the mode
// purely additive.
function getInitialUiMode() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === UI_MODES.simple || saved === UI_MODES.advanced) return saved;
  } catch {
    // best-effort, fall through to the default below
  }
  // Anything unrecognised (a stale key, a hand-edited value) falls back rather
  // than leaving the app in a mode that renders neither view.
  return UI_MODES.advanced;
}

export function useUiMode() {
  const [uiMode, setUiMode] = useState(getInitialUiMode);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, uiMode);
    } catch {
      // best-effort
    }
  }, [uiMode]);

  const toggleUiMode = () =>
    setUiMode((prev) => (prev === UI_MODES.simple ? UI_MODES.advanced : UI_MODES.simple));

  return [uiMode, toggleUiMode];
}
