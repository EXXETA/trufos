import { useCallback, useEffect, useState } from 'react';

/**
 * Same as {@link useState}, but also provides a reset function to reset the state to its initial value.
 * @param initialValue initial state value
 * @returns [state, setState, resetState]
 */
export function useStateResettable<T>(initialValue?: T) {
  const [value, setValue] = useState(initialValue);
  const reset = useCallback(() => setValue(initialValue), []);
  return [value, setValue, reset] as const;
}

/**
 * Creates a state derived from a prop using the given derive function.
 * @param prop The prop to derive the state from.
 * @param derive A function that takes the prop and returns the derived state. It should not change between renders.
 * @returns A tuple containing the derived state and a setter function.
 */
export function useStateDerived<T, P>(prop: P, derive: (prop: P) => T) {
  const [value, setValue] = useState(() => derive(prop));

  useEffect(() => {
    setValue(derive(prop));
  }, [prop]);

  return [value, setValue] as const;
}
