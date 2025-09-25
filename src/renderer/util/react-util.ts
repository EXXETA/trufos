import { useCallback, useState } from 'react';

/**
 * Same as {@link useState}, but also provides a reset function to reset the state to its initial value.
 * @param initialValue initial state value
 * @returns [state, setState, resetState]
 */
export function useStateResettable<T>(initialValue: T) {
  const [value, setValue] = useState(initialValue);
  const reset = useCallback(() => setValue(initialValue), []);
  return [value, setValue, reset] as const;
}
