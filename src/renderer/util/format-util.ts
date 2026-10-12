/**
 * Formats a byte count as a human readable size, e.g. `1.23 KB`.
 * @param sizeInByte The size in bytes.
 */
export function getSizeText(sizeInByte: number): string {
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
export function getDurationTextInSec(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(2)} s`;
}

/**
 * Formats a timestamp as local date and time, e.g. `2026-10-11 22:49:00`.
 * @param timestamp The timestamp in milliseconds since the epoch.
 */
export function getDateTimeText(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => value.toString().padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${day} ${time}`;
}
