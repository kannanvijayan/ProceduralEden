
import { strict as assert } from "assert";

/**
 * The type of unit.
 */
export type UnitType = "Deer" | "Wolf";
export const UnitType: { [key in UnitType]: number } = {
  Deer: 1,
  Wolf: 2,
};
export const UNIT_TYPES: UnitType[] = [ "Deer", "Wolf" ];
export function unitTypeFromId(id: number): UnitType {
  assert(UNIT_TYPES[id], `Invalid unit type ${id}`);
  return UNIT_TYPES[id];
}