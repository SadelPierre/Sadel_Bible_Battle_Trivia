import { z } from "zod";
import {
  addBot,
  advancePhase,
  heartbeatAndSnapshot,
  joinRoom,
  rematch,
  removePlayer,
  returnToLobby,
  setReady,
  startGame,
  submitAnswer,
  updateSettings,
} from "@/features/online/server";
import { credentialsFromRequest, errorResponse, jsonResponse } from "@/features/online/http";
import { isSupabaseServerConfigured } from "@/lib/supabase/admin";
import { clientKey, rateLimit, rateLimitDurable } from "@/lib/rateLimit";
import { displayNameSchema, isValidRoomCode, normalizeRoomCode } from "@/lib/validation";
import {
  ALL_CATEGORIES,
  PLAYER_AVATARS,
  PLAYER_COLORS,
  type GameSettings,
} from "@/types/game";

const avatarSchema = z.enum(PLAYER_AVATARS as [string, ...string[]]);
const colorSchema = z.enum(PLAYER_COLORS as [string, ...string[]]);

const authSchema = z.object({
  playerId: z.string().uuid(),
  token: z.string().uuid(),
});

const settingsSchema = z.object({
  questionCount: z.number().int().min(1).max(30),
  timerSeconds: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
  categories: z.union([
    z.literal("mixed"),
    z.array(z.enum(ALL_CATEGORIES as [string, ...string[]])).min(1),
  ]),
  scoringStyle: z.enum(["standard", "speed", "streak", "speed+streak"]),
  roundSize: z.number().int().min(0).max(30),
  revealSeconds: z.number().int().min(3).max(30),
});

type Params = { params: Promise<{ code: string; action: string }> };

export async function GET(req: Request, { params }: Params) {
  if (!isSupabaseServerConfigured()) {
    return jsonResponse({ error: "Online play is not configured.", code: "not_configured" }, 503);
  }
  const { code: rawCode, action } = await params;
  const code = normalizeRoomCode(rawCode);
  if (!isValidRoomCode(code)) {
    return jsonResponse({ error: "Invalid room code.", code: "invalid_code" }, 400);
  }
  if (action !== "state") {
    return jsonResponse({ error: "Unknown action.", code: "unknown_action" }, 404);
  }
  // Polling is frequent and creates nothing durable, so the in-memory burst
  // damper is the right tool here — a database round trip per poll is not.
  if (!rateLimit(clientKey(req, "state"), 240)) {
    return jsonResponse({ error: "Too many requests.", code: "rate_limited" }, 429);
  }
  try {
    const { playerId, token } = credentialsFromRequest(req);
    const snapshot = await heartbeatAndSnapshot(code, playerId, token);
    return jsonResponse(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  if (!isSupabaseServerConfigured()) {
    return jsonResponse({ error: "Online play is not configured.", code: "not_configured" }, 503);
  }
  const { code: rawCode, action } = await params;
  const code = normalizeRoomCode(rawCode);
  if (!isValidRoomCode(code)) {
    return jsonResponse({ error: "Invalid room code.", code: "invalid_code" }, 400);
  }
  const key = clientKey(req, `post-${action}`);
  const tooMany = { error: "Too many requests.", code: "rate_limited" };
  if (!rateLimit(key, 120)) return jsonResponse(tooMany, 429);
  // Joining is the other unauthenticated path that creates a durable row, so it
  // gets the shared limit too. In-game actions are already token-gated.
  if (action === "join" && !(await rateLimitDurable(key, 30))) {
    return jsonResponse(tooMany, 429);
  }

  try {
    const body: unknown = await req.json().catch(() => ({}));

    switch (action) {
      case "join": {
        const parsed = z
          .object({
            name: displayNameSchema,
            avatar: avatarSchema,
            color: colorSchema,
            sessionId: z.string().uuid(),
          })
          .parse(body);
        return jsonResponse(await joinRoom(code, parsed));
      }
      case "ready": {
        const parsed = authSchema.extend({ ready: z.boolean() }).parse(body);
        await setReady(code, parsed.playerId, parsed.token, parsed.ready);
        return jsonResponse({ ok: true });
      }
      case "settings": {
        const parsed = authSchema.extend({ settings: settingsSchema }).parse(body);
        await updateSettings(code, parsed.playerId, parsed.token, parsed.settings as GameSettings);
        return jsonResponse({ ok: true });
      }
      case "add-bot": {
        const parsed = authSchema
          .extend({ difficulty: z.enum(["easy", "medium", "hard"]) })
          .parse(body);
        await addBot(code, parsed.playerId, parsed.token, parsed.difficulty);
        return jsonResponse({ ok: true });
      }
      case "remove-player": {
        const parsed = authSchema.extend({ targetId: z.string().uuid() }).parse(body);
        await removePlayer(code, parsed.playerId, parsed.token, parsed.targetId);
        return jsonResponse({ ok: true });
      }
      case "start": {
        const parsed = authSchema.parse(body);
        await startGame(code, parsed.playerId, parsed.token);
        return jsonResponse({ ok: true });
      }
      case "answer": {
        const parsed = authSchema
          .extend({ answerIndex: z.number().int().min(0).max(3) })
          .parse(body);
        await submitAnswer(code, parsed.playerId, parsed.token, parsed.answerIndex);
        return jsonResponse({ ok: true });
      }
      case "advance": {
        const parsed = authSchema.parse(body);
        await advancePhase(code, parsed.playerId, parsed.token);
        return jsonResponse({ ok: true });
      }
      case "rematch": {
        const parsed = authSchema.parse(body);
        await rematch(code, parsed.playerId, parsed.token);
        return jsonResponse({ ok: true });
      }
      case "lobby": {
        const parsed = authSchema.parse(body);
        await returnToLobby(code, parsed.playerId, parsed.token);
        return jsonResponse({ ok: true });
      }
      default:
        return jsonResponse({ error: "Unknown action.", code: "unknown_action" }, 404);
    }
  } catch (err) {
    return errorResponse(err);
  }
}
