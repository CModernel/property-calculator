// TODO-192: recharts never sees Tailwind's `dark:` variant, so the series
// colours that fit the light card (violet #7c3aed is 2.6:1 on the dark one) are
// chosen here in JS, like the grid/axis/tooltip colours in each chart.
const LIGHT = { balance: '#ef4444', offset: '#3b82f6', effective: '#7c3aed' };
const DARK = { balance: '#f87171', offset: '#60a5fa', effective: '#a78bfa' };

export function chartColors(isDarkMode) {
  return isDarkMode ? DARK : LIGHT;
}

// Recharts colours each legend entry's TEXT like its series, which on the dark
// card reads as low as 2.6:1. In dark mode the text is neutral instead (the
// swatch beside it still carries the series colour).
export const DARK_LEGEND_TEXT = '#e5e7eb';
