import cors from "cors";
import express from "express";
import { getSettings } from "./config";
import { errorHandler, notFound } from "./lib/http";
import { authRouter } from "./routes/auth";
import { healthRouter } from "./routes/health";
import { projectsRouter } from "./routes/projects";
import { tasksRouter } from "./routes/tasks";
import { workspacesRouter } from "./routes/workspaces";

export function createApp() {
  const settings = getSettings();
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (settings.corsOriginList.includes("*") || settings.corsOriginList.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "100kb" }));

  app.use(healthRouter);
  app.use(authRouter);
  app.use(workspacesRouter);
  app.use(projectsRouter);
  app.use(tasksRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
