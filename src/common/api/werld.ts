import {
  MAX_SIM_LABEL_LENGTH,
  MAX_SIM_LOGIC_VERSION_LENGTH,
  WORLD_CONSTS
} from "../constants";

import {
  ProtocolObject,
  ProtocolRequestValidator,
  ProtocolResponseValidator
} from "../protocol/types";

import { SimulationInitParams } from "../simulation-state";
import { isInteger } from "../utility/type-validation";

/**
 * The server API.
 */
export type WerldServerApi = {
  "requests": {
    // Create a new simulation
    "CreateSimulation": CreateSimulationRequest,
  },
  "events": Record<string, never>,
};

export const WerldServerRequestValidator:
  ProtocolRequestValidator<WerldServerApi> =
    (name: string, params: ProtocolObject): boolean => {
      switch (name) {
        case "CreateSimulation":
          return validateCreateSimulationRequest(params);
        default:
          return false;
      }
    };

export const WerldServerResponseValidator:
  ProtocolResponseValidator<WerldServerApi> =
    (name: string, result: ProtocolObject | null): boolean => {
      switch (name) {
        case "CreateSimulation":
          return validateCreateSimulationResponse(result);
        default:
          return false;
      }
    };

type CreateSimulationRequest = {
  params: SimulationInitParams,
  response: {
    // The persistent id of the simulation.
    id: string,

    // The random seed to use to start the game.
    seed: number,
  },
};
function validateCreateSimulationRequest(params: ProtocolObject): boolean {
  const { logicVersion, label, worldDims } = params;
  if (
    typeof logicVersion !== "string" ||
    logicVersion.length > MAX_SIM_LOGIC_VERSION_LENGTH
  ) {
    return false;
  }
  if (typeof label !== "string" || label.length > MAX_SIM_LABEL_LENGTH) {
    return false;
  }
  if (!Array.isArray(worldDims) || worldDims.length !== 2) {
    return false;
  }
  if (!worldDims.every(dim => isInteger(dim))) {
    return false;
  }
  const [width, height] = worldDims as [number, number];
  if (!WORLD_CONSTS.validWidth(width)) {
    return false;
  }
  if (!WORLD_CONSTS.validHeight(height)) {
    return false;
  }
  return true;
}
function validateCreateSimulationResponse(
  params: ProtocolObject | null
): boolean {
  if (params === null) {
    return false;
  }
  const { id, seed } = params;
  if (typeof id !== "string") {
    return false;
  }
  if (typeof seed !== "number") {
    return false;
  }
  return true;
}