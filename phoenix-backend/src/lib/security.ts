import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { getSettings } from "../config";

const ITERATIONS = 200_000;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const digest = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  return `pbkdf2_sha256$${ITERATIONS}$${salt.toString("hex")}$${digest.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const [, iterations, saltHex, digestHex] = parts;
  const expected = Buffer.from(digestHex, "hex");
  if (expected.length === 0) return false;
  const actual = pbkdf2Sync(password, Buffer.from(saltHex, "hex"), Number(iterations), expected.length, "sha256");
  return timingSafeEqual(expected, actual);
}

export function createAccessToken(userId: string): string {
  const s = getSettings();
  return jwt.sign({ sub: userId }, s.JWT_SECRET, {
    algorithm: s.JWT_ALGORITHM,
    expiresIn: s.JWT_EXPIRE_MINUTES * 60,
  });
}

export function decodeAccessToken(token: string): string {
  const s = getSettings();
  const payload = jwt.verify(token, s.JWT_SECRET, { algorithms: [s.JWT_ALGORITHM] });
  if (typeof payload === "string" || !payload.sub) throw new Error("bad token payload");
  return payload.sub;
}
