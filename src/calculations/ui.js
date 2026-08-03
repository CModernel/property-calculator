export function getBalanceColor(value) {
  if (value >= 300) return 'text-green-600';
  if (value >= 0) return 'text-yellow-600';
  return 'text-red-600';
}

export function getBalanceBgColor(value) {
  if (value >= 300) return 'bg-green-50 border-green-300';
  if (value >= 0) return 'bg-yellow-50 border-yellow-300';
  return 'bg-red-50 border-red-300';
}
