import { useShallow } from 'zustand/react/shallow';

type FunctionProperties<T> = {
  [K in keyof T as T[K] extends (...args: unknown[]) => unknown ? K : never]: T[K];
};

function selectFunctionProperties<O>(object: O) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => typeof value === 'function')
  ) as FunctionProperties<O>;
}

/**
 * Returns the actions (functions) from the given state. They are shallowly selected.
 */
export const useActions = () => useShallow(selectFunctionProperties);
