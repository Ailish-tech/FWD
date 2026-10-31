import { Router } from "express";
import mongoose from "mongoose";
import { getSettings } from "../config";

export const healthRouter = Router();

healthRouter.get(["/api/health", "/health"], (_req, res) => {
  const isDbReady = mongoose.connection.readyState === 1;
  const status = isDbReady ? 200 : 503;
  res.status(status).json({
    status: isDbReady ? "ok" : "degraded",
    version: getSettings().APP_VERSION,
    db: isDbReady ? "ok" : "down",
  });
});
