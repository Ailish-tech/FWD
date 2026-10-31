import type { NextFunction, Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";
import { ZodError, type ZodTypeAny, type z } from "zod";

export class HttpError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === "string" ? detail : "HTTP error");
  }
}

/** Express 4 does not catch rejected promises - wrap every async handler. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) throw new HttpError(422, parsed.error.issues);
  return parsed.data;
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** Path ids must be 24-hex ObjectIds; anything else is a 404, never a 500. */
export function parseId(raw: string, what = "Resource"): mongoose.Types.ObjectId {
  if (!raw || typeof raw !== "string" || !OBJECT_ID.test(raw)) throw new HttpError(404, `${what} not found`);
  return new mongoose.Types.ObjectId(raw);
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ detail: "Not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ detail: err.detail });
    return;
  }
  if (err instanceof ZodError) {
    res.status(422).json({ detail: err.issues });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(404).json({ detail: "Not found" });
    return;
  }
  if (err instanceof mongoose.Error.ValidationError) {
    res.status(422).json({ detail: err.message });
    return;
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ detail: "Malformed JSON body" });
    return;
  }
  if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
  ) {
    const status = (err as { status: number }).status;
    res.status(status).json({ detail: (err as { message?: string }).message || "Request error" });
    return;
  }
  console.error(err);
  res.status(500).json({ detail: "Internal server error" });
}
