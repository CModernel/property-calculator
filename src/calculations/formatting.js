// Short money label for tight spots such as slider bounds, where a full
// "3,000,000" would crowd the control.
export function formatCompactMoney(amount) {
  const abs = Math.abs(amount);
  if (abs >= 1000000) return `${trimZeros(amount / 1000000)}M`;
  if (abs >= 1000) return `${trimZeros(amount / 1000)}k`;
  return String(amount);
}

function trimZeros(value) {
  return String(Number(value.toFixed(1)));
}

export function formatMonthsDetailed(months) {
  const totalYears = (months / 12).toFixed(1);
  const wholeYears = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const humanReadable = remainingMonths === 0
    ? `${wholeYears} ${wholeYears === 1 ? 'year' : 'years'}`
    : `${wholeYears} ${wholeYears === 1 ? 'year' : 'years'} ${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`;

  return {
    decimal: totalYears,
    technical: months,
    human: humanReadable
  };
}
