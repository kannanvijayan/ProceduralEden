
import * as uuid from "uuid";
import { MAX_SEED_VALUE } from "./common/constants";
import { SimulationInitParams } from "./common/simulation-state";

/* eslint-disable @typescript-eslint/no-empty-interface */
export interface SimulationRecordOpts extends SimulationInitParams {
}

export type SimulationId = string;
export function generateSimulationId(): SimulationId {
  return uuid.v4();
}

export class SimulationRecord {
  private readonly opts: SimulationRecordOpts;
  public readonly id: SimulationId;
  public readonly seed: number;

  constructor(opts: SimulationRecordOpts) {
    this.opts = opts;
    this.id = generateSimulationId();
    this.seed = Math.floor(Math.random() * MAX_SEED_VALUE);
  }
}