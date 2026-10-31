import type { Request, Response } from "express";
import { createApp } from "../src/app";
import { getSettings } from "../src/config";
import { connectDb } from "../src/db";

const app = createApp();

export default async function handler(req: Request, res: Response) {
  await connectDb(getSettings().MONGO_URL);
  return app(req, res);
}
