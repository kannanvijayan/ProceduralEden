import { strict as assert } from "assert";
import { SimulationRecord, SimulationId } from "./simulation-record";

/**
 * The registry keeps track of all known simulations.
 */
export class Registry {
  private loadedSimulations: Map<SimulationId, SimulationRecord> = new Map();

  public addSimulation(sim: SimulationRecord): void {
    assert(!this.loadedSimulations.has(sim.id));
    this.loadedSimulations.set(sim.id, sim);
  }

  public getSimulation(id: SimulationId): SimulationRecord | undefined {
    return this.loadedSimulations.get(id);
  }
}