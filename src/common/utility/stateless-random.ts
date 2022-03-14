import { TinyMt32 } from "./tiny-mt";

/**
 * Statelessly generate a new random number given a sequence of
 * branch values.
 */
export function statelessRandom(seed: number, branches: number[]): number {
  let result = new TinyMt32(seed).generateUint32();
  for (const b of branches) {
    result = new TinyMt32(result + b).generateUint32();
  }
  return result >>> 0;
}