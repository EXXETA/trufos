/** How the sidebar orders the items of the collection. */
export enum SortMode {
  DEFAULT = 'default',
  AZ_ASC = 'az-asc',
  AZ_DESC = 'az-desc',
  TIME_DESC = 'time-desc',
  TIME_ASC = 'time-asc',
}
export const SORT_CYCLE: SortMode[] = [
  SortMode.DEFAULT,
  SortMode.AZ_ASC,
  SortMode.AZ_DESC,
  SortMode.TIME_DESC,
  SortMode.TIME_ASC,
];
