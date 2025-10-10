/**
 * Returns a Tailwind pl-* class depending on hierarchy depth
 */
export const getIndentation = (depth: number = 0): string => {
  // Map depth levels to fixed spacing increments
  const depthToPadding: Record<number, string> = {
    0: 'pl-4',
    1: 'pl-8',
    2: 'pl-12',
    3: 'pl-16',
    4: 'pl-20',
  };
  return depthToPadding[depth] ?? 'pl-24';
};
