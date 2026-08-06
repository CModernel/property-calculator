import { useState, useEffect } from 'react';

const STORAGE_KEY = 'propertyCalculator.theme';

// Independent of src/persistence/scenarioStorage.js on purpose - a theme
// preference is a browser/device setting, not scenario data, so it must
// survive "Reset to defaults" (which only clears the scenario key).
function getInitialIsDarkMode() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
  } catch {
    // best-effort, fall through to the OS preference below
  }
  // matchMedia isn't implemented in jsdom (the app's test environment) and
  // isn't guaranteed in every embedding context either - no OS preference to
  // read means default to light rather than throw.
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Mirrors the inline boot script in index.html (same key, same fallback)
// which sets the class synchronously before React mounts, so there's no
// flash of the wrong theme on load - this hook takes over from there.
export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(getInitialIsDarkMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    try {
      localStorage.setItem(STORAGE_KEY, isDarkMode ? 'dark' : 'light');
    } catch {
      // best-effort
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  return [isDarkMode, toggleDarkMode];
}
