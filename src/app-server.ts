
import { HttpServer } from "./http-server";
import { Registry } from "./registry";
import { SocketServer } from "./socket-server";

export interface AppServerConfig {
  httpServerPort: number;
  socketServerPort: number;
}

export class AppServer {
  private readonly config: AppServerConfig;
  private readonly registry: Registry;
  private readonly httpServer: HttpServer;
  private readonly socketServer: SocketServer;

  constructor(config: AppServerConfig) {
    this.config = config;
    this.registry = new Registry();

    // Start the websocket server.
    this.socketServer = new SocketServer(
      { port: config.socketServerPort },
      this.registry
    );

    // Start the HTTP server.
    this.httpServer = new HttpServer({
      port: this.config.httpServerPort
    });
  }
}