import express, { type Express } from "express";
import path from "node:path";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: process.env.WEB_ORIGIN ?? true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (process.env.PUBLIC_DIR) {
  const publicDir = path.resolve(process.env.PUBLIC_DIR);
  app.use(express.static(publicDir, { index: "index.html" }));
  app.get("/{*splat}", (_req, res): void => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
