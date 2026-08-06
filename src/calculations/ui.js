export function getBalanceColor(value) {
  if (value >= 300) return 'text-green-600 dark:text-green-400';
  if (value >= 0) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

export function getBalanceBgColor(value) {
  if (value >= 300) return 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700';
  if (value >= 0) return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700';
  return 'bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700';
}
