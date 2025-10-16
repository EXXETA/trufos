/**
 * Returns a Tailwind pl-* class depending on hierarchy depth
 */
export const getIndentation = (depth = 0): string => {
  const map = ['pl-4', 'pl-8', 'pl-12', 'pl-16', 'pl-20', 'pl-24'];
  return map[Math.min(depth, map.length - 1)];
};
