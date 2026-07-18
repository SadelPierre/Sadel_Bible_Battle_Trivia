"use client";

/**
 * Guest identity: a random session id stored in localStorage. Sent with every
 * online API request so the server can recognize the same player across
 * refreshes/reconnects. Not a security credential by itself — the server also
 * issues a per-room player token.
 */
const KEY = "bbl-session-id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
