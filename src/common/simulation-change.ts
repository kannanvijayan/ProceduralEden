
/**
 * All "changes" on a simulation are recorded.
 */
export type AnySimulationChange = SimulationChange[keyof SimulationChange];
export type SimulationChange = {
  AddRandomUnits: {
    action: "add-random-units",
    count: number,
  };
};