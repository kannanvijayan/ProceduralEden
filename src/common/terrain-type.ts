
import { strict as assert } from "assert";

/**
 * The type of unit.
 */
export type TerrainType = 
  | "DeepWater"
  | "ShallowWater"
  | "LowLand"
  | "HighLand";
export const TerrainType: { [key in TerrainType]: number } = {
  DeepWater: 1,
  ShallowWater: 1,
  LowLand: 2,
  HighLand: 2,
};
export const TERRAIN_TYPES: TerrainType[] = [
  "DeepWater",
  "ShallowWater",
  "LowLand",
  "HighLand"
];
export function unitTypeFromId(id: number): TerrainType {
  assert(TERRAIN_TYPES[id], `Invalid unit type ${id}`);
  return TERRAIN_TYPES[id];
}