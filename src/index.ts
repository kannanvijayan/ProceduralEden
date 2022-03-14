
import dotenv from "dotenv";
import { AppServer } from "./app-server";

dotenv.config();

const HTTP_SERVER_PORT =
  Number.parseInt(process.env.HTTP_SERVER_PORT || "8088", 10);

const SOCKET_SERVER_PORT =
  Number.parseInt(process.env.SOCKET_SERVER_PORT || "8089", 10);

const App = new AppServer({
  httpServerPort: HTTP_SERVER_PORT,
  socketServerPort: SOCKET_SERVER_PORT,
});
