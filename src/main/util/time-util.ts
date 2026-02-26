import { performance } from 'node:perf_hooks';

declare type TimeUnit = 'ns' | 'us' | 'ms' | 's';

/**
 * Returns a timestamp that can be used to measure time intervals.
 */
export function getSteadyTimestamp() {
  return performance.now();
}

/**
 * Returns a human-readable string representing the duration between the given timestamp and now.
 * @param timestamp the timestamp to compare to
 * @param unit the unit to return the difference in. Default is "ms".
 * @param precision number of decimal places to include in the output. Default is 2.
 */
export function getDurationStringFromNow(timestamp: number, unit: TimeUnit = 'ms', precision = 2) {
  return `${getDurationFromNow(timestamp, unit).toFixed(precision)}${unit}`;
}

/**
 * Returns the difference between the given timestamp and the current time.
 * @param timestamp the timestamp to compare to
 * @param unit the unit to return the difference in. Default is "ms".
 */
export function getDurationFromNow(timestamp: number, unit = 'ms' as TimeUnit) {
  const diff = performance.now() - timestamp;

  switch (unit) {
    case 'ns':
      return diff * 1e6;
    case 'us':
      return diff * 1e3;
    case 'ms':
      return diff;
    case 's':
      return diff / 1e3;
    default:
      throw new Error(`Unknown unit: ${unit}`);
  }
}
