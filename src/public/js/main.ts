
import { LOGIC_VERSION } from "../../version";
import { ProtocolClient } from "../../common/protocol/client";
import { ProtocolObject } from "../../common/protocol/types";
import {
  WerldServerApi,
  WerldServerResponseValidator
} from "../../common/api/werld";
import { Simulation } from "./simulation";
import {
  SimulationInitParams,
  SimulationState
} from "../../common/simulation-state";
import { renderPerlinView } from "./components/perlin-view";

const WERLD_PROTOCOL_SERVER = "ws://localhost:8089";

//
// Main
//
document.addEventListener("DOMContentLoaded", main);
async function main() {
  //
  // Initialize page.
  //
  const canvas = await new Promise<HTMLCanvasElement>(resolve => {
    renderPerlinView({
      onCanvasReady: resolve,
      onSubmit: async params => {
        const { viewOffset, zoom } = params;
        await sim.drawPerlinFrame({ viewOffset, zoom, ...params.submitParams });
      },
      onRepaint: async params => {
        console.log(`PerlinRepaint`, params);
        await sim.repaintPerlinFrame(params);
      },
    });
  });

  // Initialize the protocol client.
  const protocolClient = await createProtocolClient();

  //
  // Create simulation.
  //

  // Initialize the simulation.
  const sim = await createSimulation({
    canvas,
    protocolClient
  });

  (window as any).SIMULATION = sim;
  sim.addNewRandomUnits(10);
  console.log("Initial", sim.simState.unitStates);
}

async function createSimulation(opts: {
  canvas: HTMLCanvasElement,
  protocolClient: ProtocolClient<WerldServerApi>,
}): Promise<Simulation> {

  const { canvas, protocolClient } = opts;
  const initParams: SimulationInitParams = {
    logicVersion: LOGIC_VERSION,
    label: "Test simulation",
    worldDims: [8 * 1024, 4 * 1024],
  };

  const computedState = await protocolClient.sendRequest(
    "CreateSimulation",
    initParams
  );

  const simState = SimulationState.createAtStart({
    ...initParams,
    ...computedState
  });
  return Simulation.createFromState({ simState, canvas });
}


// Create a protocol connection to the server.
async function createProtocolClient(): Promise<ProtocolClient<WerldServerApi>> {
  // Connect to the protocol server.
  const protocolWs = new WebSocket(WERLD_PROTOCOL_SERVER);
  await new Promise<void>(resolve => {
    protocolWs.addEventListener("open", listener);
    function listener(ev: Event) {
      protocolWs.removeEventListener("open", listener);
      resolve();
    }
  });

  // Create and return a new ProtocolClient object.
  return new ProtocolClient<WerldServerApi>({
    transport: {
      sendMessage(message: ProtocolObject): void {
        protocolWs.send(JSON.stringify(message));
      },
      onMessage(handler: (msg: string) => void): void {
        protocolWs.addEventListener("message", event => {
          if (typeof event.data === "string") {
            handler(event.data);
          } else {
            console.warn("Unrecognized message data.", event.data);
          }
        });
      }
    },
    validator: WerldServerResponseValidator,
  });
}