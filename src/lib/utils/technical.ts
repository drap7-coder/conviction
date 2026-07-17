/**
 * Pure technical analysis utilities.
 * Deterministic, no I/O, no React dependencies.
 */

/**
 * Calculate a simple moving average for a given period.
 * Returns an array the same length as `data`; leading entries
 * before the window fills are null.
 */
export function computeSma(
  data: number[],
  period: number,
): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j];
      }
      result.push(sum / period);
    }
  }
  return result;
}
