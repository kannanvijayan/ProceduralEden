import { PSEUDORANDOM_SEQUENCE_IDS, UNIT_CONSTS } from "./constants";
import { SimulationState } from "./simulation-state";
import { UnitType, unitTypeFromId } from "./unit-type";
import { statelessRandom } from "./utility/stateless-random";

/**
 * Type alias for unit indexes.
 */
export type UnitIdx = number;

/**
 * The unit state keeps all state associated with the unit.
 * 
 * In GPU memory, the unit state is stored in buffers indexed
 * by an offset which is a scaled unit index.
 */
export class UnitState {
  // The type of of unit.
  public type: UnitType;

  // 16-bit integer value representing health of unit.
  public health: number;

  // 16-bit integer values representing (x, y) coordinates of
  // unit on global map.
  public position: [number, number];

  private constructor(opts: {
    type: UnitType,
    health: number,
    position: [number, number]
  }) {
    this.type = opts.type;
    this.health = opts.health;
    this.position = opts.position;
  }

  public writeStateToArray(array: Uint32Array, offset: number): void {
    const type_and_health = UnitType[this.type] | (this.health << 16);
    array[offset + UNIT_STATE_OFFSETS.type_and_health] = type_and_health;

    const position = this.position[0] | (this.position[1] << 16);
    array[offset + UNIT_STATE_OFFSETS.position] = position;
  }

  public static create(opts: {
    index: UnitIdx,
    position: [number, number]
  }): UnitState {
    return new UnitState({
      ...opts,
      health: UNIT_CONSTS.defaultHealth,
      type: UNIT_CONSTS.defaultType,
    });
  }

  public static createNewRandom(
    index: UnitIdx,
    state: SimulationState
  ): UnitState {
    const [ worldWidth, worldHeight ] = state.initState.worldDims;
    const posnValue = statelessRandom(state.initState.seed, [
      PSEUDORANDOM_SEQUENCE_IDS.initializationTurn,
      PSEUDORANDOM_SEQUENCE_IDS.unitPosition,
      index,
    ]);
    console.log("PosnValue", posnValue.toString(16));
    const posnX = (posnValue & 0xffff) % worldWidth;
    const posnY = ((posnValue >> 16) & 0xffff) % worldHeight;
    return UnitState.create({
      index,
      position: [ posnX, posnY ],
    });
  }

  public static readFromArray(array: Uint32Array, offset: number): UnitState {
    const type_and_health = array[offset + UNIT_STATE_OFFSETS.type_and_health];
    const position = array[offset + UNIT_STATE_OFFSETS.position];
    const type = unitTypeFromId(type_and_health & 0xffff);
    const health = (type_and_health >> 16) & 0xffff;
    const posx = position & 0xffff;
    const posy = (position >> 16) & 0xffff;
    return new UnitState({
      type,
      health,
      position: [posx, posy],
    });
  }
}

export const UNIT_STATE_ELEM_SIZE = 4;
export const UNIT_STATE_ELEM_COUNT = 2;
export const UNIT_STATE_OFFSETS = {
  // Offset at which 'health' value can be found (u16 value)
  type_and_health: 0,

  // Offsets at which the (x, y) positions of the unit are found.
  position: 1,
};