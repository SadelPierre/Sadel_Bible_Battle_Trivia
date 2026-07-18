import { NextResponse } from "next/server";
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
import { errorResponse } from "@/features/online/http";
import { isSupabaseServerConfigured } from "@/lib/supabase/admin";
import { clientKey, rateLimit } from "@/lib/rateLimit";
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
    return NextResponse.json({ error: "Online play is not configured.", code: "not_configured" }, { status: 503 });
  }
  const { code: rawCode, action } = await params;
  const code = normalizeRoomCode(rawCode);
  if (!isValidRoomCode(code)) {
    return NextResponse.json({ error: "Invalid room code.", code: "invalid_code" }, { status: 400 });
  }
  if (action !== "state") {
    return NextResponse.json({ error: "Unknown action.", code: "unknown_action" }, { status: 404 });
  }
  if (!rateLimit(clientKey(req, "state"), 240)) {
    return NextResponse.json({ error: "Too many requests.", code: "rate_limited" }, { status: 429 });
  }
  try {
    const url = new URL(req.url);
    const snapshot = await heartbeatAndSnapshot(
      code,
      url.searchParams.get("playerId"),
      url.searchParams.get("token"),
    );
    return NextResponse.json(snapshot);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: "Online play is not configured.", code: "not_configured" }, { status: 503 });
  }
  const { code: rawCode, action } = await params;
  const code = normalizeRoomCode(rawCode);
  if (!isValidRoomCode(code)) {
    return NextResponse.json({ error: "Invalid room code.", code: "invalid_code" }, { status: 400 });
  }
  if (!rateLimit(clientKey(req, `post-${action}`), 120)) {
    return NextResponse.json({ error: "Too many requests.", code: "rate_limited" }, { status: 429 });
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
        return NextResponse.json(await joinRoom(code, parsed));
      }
      case "ready": {
        const parsed = authSchema.extend({ ready: z.boolean() }).parse(body);
        await setReady(code, parsed.playerId, parsed.token, parsed.ready);
        return NextResponse.json({ ok: true });
      }
      case "settings": {
        const parsed = authSchema.extend({ settings: settingsSchema }).parse(body);
        await updateSettings(code, parsed.playerId, parsed.token, parsed.settings as GameSettings);
        return NextResponse.json({ ok: true });
      }
      case "add-bot": {
        const parsed = authSchema
          .extend({ difficulty: z.enum(["easy", "medium", "hard"]) })
          .parse(body);
        await addBot(code, parsed.playerId, parsed.token, parsed.difficulty);
        return NextResponse.json({ ok: true });
      }
      case "remove-player": {
        const parsed = authSchema.extend({ targetId: z.string().uuid() }).parse(body);
        await removePlayer(code, parsed.playerId, parsed.token, parsed.targetId);
        return NextResponse.json({ ok: true });
      }
      case "start": {
        const parsed = authSchema.parse(body);
        await startGame(code, parsed.playerId, parsed.token);
        return NextResponse.json({ ok: true });
      }
      case "answer": {
        const parsed = authSchema
          .extend({ answerIndex: z.number().int().min(0).max(3) })
          .parse(body);
        await submitAnswer(code, parsed.playerId, parsed.token, parsed.answerIndex);
        return NextResponse.json({ ok: true });
      }
      case "advance": {
        const parsed = authSchema.parse(body);
        await advancePhase(code, parsed.playerId, parsed.token);
        return NextResponse.json({ ok: true });
      }
      case "rematch": {
        const parsed = authSchema.parse(body);
        await rematch(code, parsed.playerId, parsed.token);
        return NextResponse.json({ ok: true });
      }
      case "lobby": {
        const parsed = authSchema.parse(body);
        await returnToLobby(code, parsed.playerId, parsed.token);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action.", code: "unknown_action" }, { status: 404 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
