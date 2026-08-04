// Ordered highest-LVR-band first. `min` is each band's inclusive lower bound;
// the matching band is the first whose lvr >= min. The final band's -Infinity
// is deliberately the catch-all: it also covers 0, negative, and any
// non-finite lvr defensively (safePercentage never actually produces NaN/
// Infinity, but classifyLvr shouldn't rely on that guarantee to stay correct).
export const LVR_BANDS = [
  { min: 90, band: '>90%', symbol: '🔴', summary: 'High risk, low equity', textClass: 'text-red-600', bgClass: 'bg-red-50 border-red-300' },
  { min: 80, band: '80–90%', symbol: '🟠', summary: 'Acceptable, limited flexibility', textClass: 'text-orange-600', bgClass: 'bg-orange-50 border-orange-300' },
  { min: 70, band: '70–80%', symbol: '🟢', summary: 'Balanced, good position', textClass: 'text-green-600', bgClass: 'bg-green-50 border-green-300' },
  { min: 60, band: '60–70%', symbol: '🟢', summary: 'Strong, excellent flexibility', textClass: 'text-green-600', bgClass: 'bg-green-50 border-green-300' },
  { min: -Infinity, band: '<60%', symbol: '🔵', summary: 'Very safe, maximum flexibility', textClass: 'text-blue-600', bgClass: 'bg-blue-50 border-blue-300' },
];

export function classifyLvr(lvr) {
  return LVR_BANDS.find((band) => lvr >= band.min) ?? LVR_BANDS[LVR_BANDS.length - 1];
}
