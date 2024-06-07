declare type TimeUnit = "ns" | "us" | "ms" | "s";

/**
 * Returns a timestamp that can be used to measure time intervals.
 */
export function getSteadyTimestamp() {
  return process.hrtime.bigint();
}

/**
 * Returns the difference between the given timestamp and the current time.
 * @param timestamp the timestamp to compare to
 * @param unit the unit to return the difference in. Default is "ms".
 */
export function getDurationFromNow(timestamp: bigint, unit = "ms" as TimeUnit) {
  const diff = Number(getSteadyTimestamp() - timestamp);

  switch (unit) {
    case "ns":
      return diff;
    case "us":
      return diff / 1e3;
    case "ms":
      return diff / 1e6;
    case "s":
      return diff / 1e9;
    default:
      throw new Error(`Unknown unit: ${unit}`);
  }
}
