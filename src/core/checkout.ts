import { Dart } from './types';

export const IMPOSSIBLE_CHECKOUTS = new Set([159, 162, 163, 165, 166, 168, 169]);

export function formatDartLabel(d: Dart): string {
  if (d.m === 0) return 'Miss';
  if (d.n === 25) {
    return d.m === 2 ? 'Bull' : '25';
  }
  const prefix = ['', 'S', 'D', 'T'][d.m] ?? '';
  return `${prefix}${d.n}`;
}

export function getDartValue(d: Dart): number {
  return d.m * d.n;
}

// All possible valid dart throws sorted by score descending for greedy preference
export const ALL_THROWS: Dart[] = [];
// Trebles 20 down to 1
for (let n = 20; n >= 1; n--) ALL_THROWS.push({ m: 3, n });
// Bull (50)
ALL_THROWS.push({ m: 2, n: 25 });
// Doubles 20 down to 1
for (let n = 20; n >= 1; n--) ALL_THROWS.push({ m: 2, n });
// Outer Bull (25)
ALL_THROWS.push({ m: 1, n: 25 });
// Singles 20 down to 1
for (let n = 20; n >= 1; n--) ALL_THROWS.push({ m: 1, n });

function searchCheckout(rem: number, dartsLeft: number, path: Dart[], doubleOut: boolean): Dart[] | null {
  for (const throwOpt of ALL_THROWS) {
    const val = getDartValue(throwOpt);
    if (dartsLeft === 1) {
      if (val === rem && (!doubleOut || throwOpt.m === 2)) {
        return [...path, throwOpt];
      }
    } else {
      const nextRem = rem - val;
      const minRequired = doubleOut ? 2 : 1;
      if (nextRem >= minRequired) {
        const result = searchCheckout(nextRem, dartsLeft - 1, [...path, throwOpt], doubleOut);
        if (result) return result;
      }
    }
  }
  return null;
}

/**
 * Finds an optimal checkout combination for a given remaining score and available darts (1-3).
 * Deterministically returns null if score cannot be finished within dartsLeft.
 */
export function getCheckout(remaining: number, dartsLeft: number, doubleOut: boolean = true): Dart[] | null {
  if (remaining < (doubleOut ? 2 : 1) || remaining > 170) {
    return null;
  }
  if (doubleOut && IMPOSSIBLE_CHECKOUTS.has(remaining)) {
    return null;
  }

  const boundedDarts = Math.max(1, Math.min(3, dartsLeft));
  // Try to find checkout in 1 dart first, then 2, then 3 darts
  for (let k = 1; k <= boundedDarts; k++) {
    const solution = searchCheckout(remaining, k, [], doubleOut);
    if (solution) return solution;
  }
  return null;
}

export function formatCheckoutText(darts: Dart[]): string {
  return darts.map(formatDartLabel).join(' ');
}
