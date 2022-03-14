import { strict as assert } from "assert";
import { SimulationId } from "../simulation-record";
import { UNIT_CONSTS } from "./constants";
import { AnySimulationChange } from "./simulation-change";
import { UnitState, UNIT_STATE_ELEM_COUNT } from "./unit-state";

/**
 * The initializaition info for a simulation.
 */
export type SimulationInitParams = {
  // The simulation logic version, which allows the simulation
  // to be replayed deterministically from the seed.
  logicVersion: string;

  // A label for this simulation.
  label: string;

  // The width and height of the world.
  worldDims: [number, number];
}

/**
 * The initial state for a simulation.
 */
export type SimulationInitState = SimulationInitParams & {
  id: SimulationId;
  seed: number;
};

/**
 * The simulation state represents all the state associated with
 * an active simulation.
 */
export class SimulationState {
  // The init info for the simulation.
  readonly initState: SimulationInitState;

  // The actions list.
  readonly actions: AnySimulationChange[];

  // The next turn number.
  readonly nextTurn: number;

  // The unit states.
  readonly unitStates: UnitState[];

  private constructor(opts: {
    initState: SimulationInitState,
    nextTurn: number,
    unitStates: UnitState[],
    actions: AnySimulationChange[],
  }) {
    this.initState = opts.initState;
    this.nextTurn = opts.nextTurn;
    this.unitStates = opts.unitStates;
    this.actions = opts.actions;
  }

  public static createAtStart(initState: SimulationInitState): SimulationState {
    return new SimulationState({
      initState,
      nextTurn: 1,
      unitStates: [],
      actions: [],
    });
  }

  public unitStatesArraySize(): number {
    return this.unitStates.length;
  }

  // Adds some number of new random units.
  public addNewRandomUnits(count: number) {
    for (let i = 0; i < count; i++) {
      this.addNewRandomUnitImpl();
    }
    this.actions.push({ action: "add-random-units", count });
  }

  // Adds a new random unit and returns its idx.
  private addNewRandomUnitImpl(): number {
    const index = this.unitStates.length;
    assert(index <= UNIT_CONSTS.maxUnits);
    if (index == UNIT_CONSTS.maxUnits) {
      throw new Error("Maximum unit limit reached");
    }
    const unit = UnitState.createNewRandom(index, this);
    this.unitStates.push(unit);
    return index;
  }

  /** Return a Uint32Array of all the globals. */
  public makeGlobalsArray(): Uint32Array {
    const array = new Uint32Array(GLOBAL_ELEM_COUNT);
    this.updateGlobalsArray(array);
    return array;
  }
  public updateGlobalsArray(array: Uint32Array): void {
    array[GLOBAL_OFFSETS.worldWidth] = this.initState.worldDims[0];
    array[GLOBAL_OFFSETS.worldHeight] = this.initState.worldDims[1];
    array[GLOBAL_OFFSETS.seed] = this.initState.seed;
    array[GLOBAL_OFFSETS.unitStatesArraySize] = this.unitStatesArraySize();
    array[GLOBAL_OFFSETS.nextTurn] = this.nextTurn;
  }

  /* Write all unit states to the given array. */
  public writeUnitStatesToArray(array: Uint32Array): void {
    this.unitStates.forEach((unitState, i) => {
      unitState.writeStateToArray(array, i * UNIT_STATE_ELEM_COUNT);
    });
  }
}

export const GLOBAL_ELEM_SIZE = 4;
export const GLOBAL_ELEM_COUNT = 5;
export const GLOBAL_OFFSETS = {
  // Initial state info.
  worldWidth: 0,
  worldHeight: 1,
  seed: 2,

  // The next turn number.
  nextTurn: 3,

  // The size of the units array.
  unitStatesArraySize: 4,
};