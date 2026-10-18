import { SortMode } from 'shim/sort-mode';

/** The order in which the sort button cycles through the sort modes. */
export const SORT_CYCLE: SortMode[] = [
  SortMode.DEFAULT,
  SortMode.AZ_ASC,
  SortMode.AZ_DESC,
  SortMode.TIME_DESC,
  SortMode.TIME_ASC,
];
