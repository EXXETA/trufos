/**
 * Returns a Tailwind pl-* class depending on hierarchy depth
 */
export const getIndentation = (depth: number = 0): string => `pl-${Math.min(depth, 5) * 4 + 4}`;
