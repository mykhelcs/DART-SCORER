import { describe, it, expect } from 'vitest';
import { formatDartLabel, getDartValue, getCheckout, formatCheckoutText, IMPOSSIBLE_CHECKOUTS } from '../checkout';

describe('Checkout and Dart Helpers', () => {
  it('correctly labels different dart throws', () => {
    expect(formatDartLabel({ m: 0, n: 0 })).toBe('Miss');
    expect(formatDartLabel({ m: 1, n: 20 })).toBe('S20');
    expect(formatDartLabel({ m: 2, n: 20 })).toBe('D20');
    expect(formatDartLabel({ m: 3, n: 20 })).toBe('T20');
    expect(formatDartLabel({ m: 1, n: 25 })).toBe('25');
    expect(formatDartLabel({ m: 2, n: 25 })).toBe('Bull');
  });

  it('calculates dart values accurately', () => {
    expect(getDartValue({ m: 3, n: 20 })).toBe(60);
    expect(getDartValue({ m: 2, n: 25 })).toBe(50);
    expect(getDartValue({ m: 1, n: 25 })).toBe(25);
    expect(getDartValue({ m: 2, n: 16 })).toBe(32);
    expect(getDartValue({ m: 0, n: 0 })).toBe(0);
  });

  it('finds single dart double-out finishes', () => {
    const co40 = getCheckout(40, 3, true);
    expect(co40).toBeDefined();
    expect(co40).toHaveLength(1);
    expect(co40![0]).toEqual({ m: 2, n: 20 });
    expect(formatCheckoutText(co40!)).toBe('D20');

    const co50 = getCheckout(50, 1, true);
    expect(co50).toBeDefined();
    expect(co50).toEqual([{ m: 2, n: 25 }]);
    expect(formatCheckoutText(co50!)).toBe('Bull');
  });

  it('correctly returns null for 1 remaining or impossible finishes', () => {
    expect(getCheckout(1, 3, true)).toBeNull();
    expect(getCheckout(0, 3, true)).toBeNull();
    expect(getCheckout(171, 3, true)).toBeNull();

    for (const impossible of IMPOSSIBLE_CHECKOUTS) {
      expect(getCheckout(impossible, 3, true)).toBeNull();
    }
  });

  it('solves the highest checkout (170)', () => {
    const co170 = getCheckout(170, 3, true);
    expect(co170).toBeDefined();
    expect(co170).toHaveLength(3);
    expect(formatCheckoutText(co170!)).toBe('T20 T20 Bull');
  });

  it('finds 2-dart checkouts', () => {
    const co100 = getCheckout(100, 2, true);
    expect(co100).toBeDefined();
    expect(co100).toHaveLength(2);
    // T20 D20 = 100
    expect(formatCheckoutText(co100!)).toBe('T20 D20');
  });

  it('handles straight-out mode when doubleOut is false', () => {
    const co1 = getCheckout(1, 3, false);
    expect(co1).toBeDefined();
    expect(co1).toHaveLength(1);
    expect(co1![0]).toEqual({ m: 1, n: 1 });
  });
});
