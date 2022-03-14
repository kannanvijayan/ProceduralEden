import { UnitType } from "./unit-type";

/** Constants associated with the protocol */
export const PROTOCOL_CONSTS = {
  requestIdMod: 1,
  responseIdMod: 2,
  eventIdMod: 3,
  errorIdMod: 9,
  messageIdIncr: 10,
};

/** The maximum seed value. */
export const MAX_SEED_VALUE = 1e15;

/** Maximum simulation logic-version length. */
export const MAX_SIM_LOGIC_VERSION_LENGTH = 64;

/** Maximum simulation label length. */
export const MAX_SIM_LABEL_LENGTH = 64;

/*** Compute shader workgroup size */
export const SHADER_WORKGROUP_SIZE = 16;

/** World dimensions constants. */
export const WORLD_CONSTS = {
  minWidth: 1 << 7,  // 128
  maxWidth: 1 << 15, // 32k
  validWidth(width: number): boolean {
    return (
      width >= this.minWidth &&
      width <= this.maxWidth &&
      (width % this.minWidth) === 0
    );
  },

  minHeight: 1 << 7,  // 128
  maxHeight: 1 << 13, // 8k
  validHeight(height: number): boolean {
    return (
      height >= this.minHeight &&
      height <= this.maxHeight &&
      (height % this.minHeight) === 0
    );
  },

  geoTileScale: 4,
  bigTileScale: 16,
};

/** Unit-related constants. */
export const UNIT_CONSTS = {
  /** Maximum number of units allowed. */
  maxUnits: 1 << 20,

  /** The default unit type. */
  defaultType: "Deer" as UnitType,

  /** The defualt unit health. */
  defaultHealth: 1000,
};


// The following values provide random-index-sequences
// for generating pseudorandom numbers for various target values.
export const PSEUDORANDOM_SEQUENCE_IDS = {
  // The "turn number" used to generate random values used in initializations.
  initializationTurn: -1,

  // Sequence id to generate values for unit positions.
  unitPosition: 1,
};