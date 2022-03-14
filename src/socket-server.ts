
import ws from "ws";
import {
  WerldServerApi,
  WerldServerRequestValidator
} from "./common/api/werld";
import { ProtocolServer } from "./common/protocol/server";
import { Registry } from "./registry";
import { SimulationRecord } from "./simulation-record";

export interface SocketServerConfig {
  port: number;
}

export class SocketServer {
  private readonly config: SocketServerConfig;
  readonly registry: Registry;
  private readonly wsServer: ws.Server;
  private readonly connections: Set<ConnectionInfo> = new Set();

  constructor(config: SocketServerConfig, registry: Registry) {
    this.config = config;
    this.registry = registry;
    // Start the websocket server.
    this.wsServer = new ws.Server(
      { port: config.port, },
      () => {
        console.log(`Started websocket server on port ${this.config.port}`)
      }
    );
    this.wsServer.on("connection", this.onConnection.bind(this));
  }

  private onConnection(socket: ws.WebSocket) {
    console.log("Got WebSocket Connection.");
    const connectionInfo = new ConnectionInfo(this, socket);
    this.connections.add(connectionInfo);
  }
}

class ConnectionInfo {
  private readonly server: SocketServer;
  private readonly wSocket: ws.WebSocket;
  private readonly protocolServer: ProtocolServer<WerldServerApi>;
  private readonly messageHandlers: ((message: string | Buffer) => void)[] = [];

  constructor(server: SocketServer, wSocket: ws.WebSocket) {
    this.server = server;
    this.wSocket = wSocket;
    wSocket.on(
      "message",
      (data, isBinary) => this.dispatchMessage(data, isBinary)
    );
    this.protocolServer = new ProtocolServer({
      transport: {
        onMessage: handler => this.messageHandlers.push(handler),
        sendMessage: message => this.wSocket.send(JSON.stringify(message)),
      },
      validator: WerldServerRequestValidator,
      requestHandler: {
        CreateSimulation: async ({ logicVersion, label, worldDims }) => {
          console.log(`CreateSimulation`, { logicVersion, label, worldDims });
          const sim = new SimulationRecord({ logicVersion, label, worldDims });
          this.server.registry.addSimulation(sim);
          const { id, seed } = sim;
          return { id, seed };
        },
      }
    });
  }

  private dispatchMessage(data: ws.Data, isBinary: boolean): void {
    if (typeof data !== "string" && !Buffer.isBuffer(data)) {
      console.warn("Rejecting message because it's not a string or buffer.")
      return;
    }
    if (Buffer.isBuffer(data) && !isBinary) {
      data = data.toString("utf-8");
    }
    for (const handler of this.messageHandlers) {
      try {
        handler(data);
      } catch (err) {
        console.error("Failed to handle message.", err)
      }
    }
  }
}