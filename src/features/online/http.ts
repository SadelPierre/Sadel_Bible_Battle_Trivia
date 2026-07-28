import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { RoomError } from "./server";

/**
 * Every room response is per-player and short-lived, and some carry credentials
 * back to the browser. None of it may sit in a shared cache.
 */
export function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store, no-cache, must-revalidate, private" },
  });
}

export function errorResponse(err: unknown) {
  if (err instanceof RoomError) {
    return jsonResponse({ error: err.message, code: err.code }, err.status);
  }
  if (err instanceof z.ZodError) {
    return jsonResponse(
      { error: err.issues[0]?.message ?? "Invalid request", code: "invalid_body" },
      400,
    );
  }
  console.error("API error:", err);
  return jsonResponse({ error: "Something went wrong.", code: "internal" }, 500);
}

/**
 * Room credentials arrive in the Authorization header, never the URL.
 * Query strings end up in proxy access logs, error trackers and diagnostic
 * captures; a leaked room token authorizes play, and a host's authorizes
 * kicking players and controlling the match.
 */
export function credentialsFromRequest(
  req: Request,
): { playerId: string; token: string } | { playerId: null; token: null } {
  const header = req.headers.get("authorization");
  const raw = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  const [playerId, token] = raw?.split(".") ?? [];
  if (!playerId || !token) return { playerId: null, token: null };
  return { playerId, token };
}
