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
