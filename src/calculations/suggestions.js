export function getNextSuggestion(list) {
  if (list.length === 0) return 1;
  return Math.max(...list.map(c => c.startMonth)) + 1;
}
