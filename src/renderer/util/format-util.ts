/**
 * Formats a byte count as a human readable size, e.g. `1.23 KB`.
 * @param sizeInByte The size in bytes.
 */
export function getSizeText(sizeInByte: number) {
  const units = ['', 'K', 'M', 'G', 'T'];
  let size = sizeInByte;

  let i = 0;
  for (; i < units.length && size >= 1e3; i++) {
    size /= 1e3;
  }

  const sizeWithDigits = i == 0 ? size : size.toFixed(2);

  return `${sizeWithDigits} ${units[i]}B`;
}

/**
 * Formats a duration in milliseconds as seconds with two digits, e.g. `1.23 s`.
 * @param durationMs The duration in milliseconds.
 */
export function getDurationTextInSec(durationMs: number) {
  return `${(durationMs / 1000).toFixed(2)} s`;
}

/**
 * Formats a timestamp as a localized time, e.g. `14:05:59`.
 * @param timestamp The timestamp in milliseconds since the epoch.
 */
export function getTimeText(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Formats a timestamp as a short localized date, e.g. `Jul 9`.
 * @param timestamp The timestamp in milliseconds since the epoch.
 */
export function getDateText(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
