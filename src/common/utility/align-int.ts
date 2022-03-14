
/**
 * Align an integer up to the next given power of two.
 */
export function alignIntegerUp(value: number, powerOfTwo: number): number {
  const mask = powerOfTwo - 1;
  return (value + mask) & ~mask;
}

/**
 * Round a number up to the nearest spacing interval.
 */
export function roundNumberUp(value: number, spacing: number): number {
  return Math.ceil(value / spacing) * spacing;
}

/**
 * Round a number down to the nearest spacing interval.
 */
export function roundNumberDown(value: number, spacing: number): number {
  return Math.floor(value / spacing) * spacing;
}

/**
 * Check if a number is a power of two.
 */
export function isPowerOfTwo(value: number): boolean {
  return (value & (value - 1)) == 0;
}