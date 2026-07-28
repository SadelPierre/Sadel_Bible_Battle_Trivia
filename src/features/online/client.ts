"use client";

/**
 * Client-side API wrapper for online rooms. Per-room credentials (playerId +
 * token) are kept in localStorage so a refresh reconnects to the same seat.
 */
import type { GameSettings } from "@/types/game";
import type { JoinResult, RoomSnapshot } from "./types";
import { getSessionId } from "@/lib/session";

export class OnlineError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new OnlineError(
      typeof data.error === "string" ? data.error : "Request failed",
      typeof data.code === "string" ? data.code : "unknown",
      res.status,
    );
  }
  return data as T;
}

export type RoomCredentials = { playerId: string; token: string };

/**
 * Room credentials travel in the Authorization header, never in the URL.
 * Query strings are retained by proxy access logs, error trackers and support
 * captures, and this token is enough to act as the player — or, for a host, to
 * control the whole room.
 */
function authHeader(creds: RoomCredentials | null): Record<string, string> {
  return creds ? { authorization: `Bearer ${creds.playerId}.${creds.token}` } : {};
}

const credsKey = (code: string) => `bbl-room-${code}`;

export function saveCredentials(code: string, creds: RoomCredentials): void {
  window.localStorage.setItem(credsKey(code), JSON.stringify(creds));
}

export function loadCredentials(code: string): RoomCredentials | null {
  try {
    const raw = window.localStorage.getItem(credsKey(code));
    return raw ? (JSON.parse(raw) as RoomCredentials) : null;
  } catch {
    return null;
  }
}

export function clearCredentials(code: string): void {
  window.localStorage.removeItem(credsKey(code));
}

export type IdentityInput = { name: string; avatar: string; color: string };

/**
 * Retry key for room creation. Held until a create succeeds, so a double tap or
 * a retry after a lost response returns the room the first attempt made instead
 * of stranding it and creating another.
 */
let pendingCreateId: string | null = null;

export async function createRoomApi(
  identity: IdentityInput,
  opts?: { mode?: "online" | "tournament"; maxPlayers?: number },
): Promise<JoinResult> {
  const mode = opts?.mode ?? "online";
  const maxPlayers = opts?.maxPlayers ?? (mode === "tournament" ? 30 : 4);
  pendingCreateId ??= crypto.randomUUID();
  const result = await api<JoinResult>("/api/rooms", {
    method: "POST",
    body: JSON.stringify({
      ...identity,
      sessionId: getSessionId(),
      maxPlayers,
      mode,
      operationId: pendingCreateId,
    }),
  });
  pendingCreateId = null;
  saveCredentials(result.code, { playerId: result.playerId, token: result.token });
  return result;
}

/** Create a knockout tournament room (survival elimination + duel final, up to 30). */
export function createTournamentApi(identity: IdentityInput): Promise<JoinResult> {
  return createRoomApi(identity, { mode: "tournament" });
}

export async function joinRoomApi(code: string, identity: IdentityInput): Promise<JoinResult> {
  const result = await api<JoinResult>(`/api/rooms/${code}/join`, {
    method: "POST",
    body: JSON.stringify({ ...identity, sessionId: getSessionId() }),
  });
  saveCredentials(result.code, { playerId: result.playerId, token: result.token });
  return result;
}

export async function fetchSnapshot(
  code: string,
  creds: RoomCredentials | null,
): Promise<RoomSnapshot> {
  return api<RoomSnapshot>(`/api/rooms/${code}/state`, { headers: authHeader(creds) });
}

function action(code: string, name: string, creds: RoomCredentials, extra: object = {}) {
  return api<{ ok: true }>(`/api/rooms/${code}/${name}`, {
    method: "POST",
    body: JSON.stringify({ ...creds, ...extra }),
  });
}

export const roomActions = {
  ready: (code: string, creds: RoomCredentials, ready: boolean) =>
    action(code, "ready", creds, { ready }),
  settings: (code: string, creds: RoomCredentials, settings: GameSettings) =>
    action(code, "settings", creds, { settings }),
  addBot: (code: string, creds: RoomCredentials, difficulty: "easy" | "medium" | "hard") =>
    action(code, "add-bot", creds, { difficulty }),
  removePlayer: (code: string, creds: RoomCredentials, targetId: string) =>
    action(code, "remove-player", creds, { targetId }),
  start: (code: string, creds: RoomCredentials) => action(code, "start", creds),
  answer: (code: string, creds: RoomCredentials, answerIndex: number) =>
    action(code, "answer", creds, { answerIndex }),
  advance: (code: string, creds: RoomCredentials) => action(code, "advance", creds),
  rematch: (code: string, creds: RoomCredentials) => action(code, "rematch", creds),
  lobby: (code: string, creds: RoomCredentials) => action(code, "lobby", creds),
  leave: (code: string, creds: RoomCredentials) =>
    action(code, "remove-player", creds, { targetId: creds.playerId }),
};
