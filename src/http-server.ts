
import express from "express";
import path from "path";

export interface HttpServerConfig {
  port: number;
}

export class HttpServer {
  private readonly config: HttpServerConfig;
  private readonly httpServer: express.Express;

  constructor(config: HttpServerConfig) {
    this.config = config;

    // Start the HTTP server.
    this.httpServer = express();
    // Serve static files out of "public" dir.
    this.httpServer.set("views", path.join(__dirname, "public"));
    this.httpServer.use(express.static(path.join(__dirname, "public")));

    this.httpServer.get("/", (req, res) => {
      res.render("index.html");
    });

    this.httpServer.listen(this.config.port, () => {
      // tslint:disable-next-line:no-console
      console.log(`Started http server on port ${this.config.port}`);
    });
  }
}