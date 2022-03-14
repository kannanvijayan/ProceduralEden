
export type Vector2D = [number, number];
export type Dims2D = Vector2D;
export type Coord2D = Vector2D;

export function vec2Equal(v1: Vector2D, v2: Vector2D): boolean {
  return (v1[0] === v2[0]) && (v1[1] === v2[1]);
}

/**
 * Get the magnitude of a 2d vector.
 */
export function magnitude2d(vec: Vector2D): number {
  return Math.sqrt((vec[0] ** 2) + (vec[1] ** 2));
}

/**
 * Normalize a 2D vector.
 */
export function normalize2d(vec: Vector2D): Vector2D {
  const mag = magnitude2d(vec);
  return [vec[0] / mag, vec[1] / mag];
}

/**
 * Clamp a 2D vector to a maximal length
 */
export function clamp2d(vec: Vector2D, len = 1): Vector2D {
  const mag = magnitude2d(vec);
  if (mag > len) {
    const ratio = len / mag;
    return [vec[0] * ratio, vec[1] * ratio];
  } else {
    return vec;
  }
}

/**
 * The dot product of two 2D vetors.
 */
export function dotProduct2D(a: Vector2D, b: Vector2D): number {
  return a[0] * b[0] + a[1] * b[1];
}