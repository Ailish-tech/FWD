import { clearCache, getCached, setCached } from "./cache";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

export const TOKEN_KEY = "phoenix.token";

let currentToken: string | null = null;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function getToken(): string | null {
  if (currentToken !== null) return currentToken;
  if (typeof window !== "undefined") {
    currentToken =
      window.localStorage.getItem(TOKEN_KEY) ||
      window.localStorage.getItem("phoenix_token");
  }
  return currentToken;
}

export function setToken(value: string | null) {
  currentToken = value;
  if (typeof window !== "undefined") {
    if (value) {
      window.localStorage.setItem(TOKEN_KEY, value);
      window.localStorage.setItem("phoenix_token", value);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem("phoenix_token");
    }
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  cache?: boolean;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const authToken = getToken();
  const cacheKey = `${authToken ?? "anon"}:${path}`;
  if (method === "GET" && opts.cache) {
    const hit = getCached<T>(cacheKey);
    if (hit !== undefined) return hit;
  }

  const normalizedBase = API_URL.replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${normalizedBase}${path}`, {
      method,
      signal: opts.signal,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...opts.headers,
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "Cannot reach the server. Check your connection.");
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }

  const data = (await res.json()) as T;
  if (method === "GET" && opts.cache) {
    setCached(cacheKey, data);
  } else if (method !== "GET") {
    clearCache();
  }
  return data;
}

export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return err.message;
    if (err.status === 401) {
      if (
        err.message &&
        err.message !== "Unauthorized" &&
        err.message !== "Not authenticated" &&
        err.message !== "Invalid or expired token"
      ) {
        return err.message;
      }
      return "Your session has expired. Please log in again.";
    }
    if (err.status === 402) return "Not enough credits. Ask the workspace owner to top up.";
    if (err.status === 403) return "You don't have permission to do that.";
    if (err.status === 404) return "Not found (or you don't have access).";
    if (err.status >= 500) return "Server error. Please try again.";
    return err.message;
  }
  return "Unexpected error.";
}
