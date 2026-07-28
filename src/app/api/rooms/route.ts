import { z } from "zod";
import { createRoom } from "@/features/online/server";
import { errorResponse, jsonResponse } from "@/features/online/http";
import { isSupabaseServerConfigured } from "@/lib/supabase/admin";
import { clientKey, rateLimit, rateLimitDurable } from "@/lib/rateLimit";
import { displayNameSchema } from "@/lib/validation";
import { PLAYER_AVATARS, PLAYER_COLORS } from "@/types/game";

const avatarSchema = z.enum(PLAYER_AVATARS as [string, ...string[]]);
const colorSchema = z.enum(PLAYER_COLORS as [string, ...string[]]);

const bodySchema = z.object({
  name: displayNameSchema,
  avatar: avatarSchema,
  color: colorSchema,
  sessionId: z.string().uuid(),
  // Upper bound is the tournament cap; createRoom clamps to the per-mode range.
  maxPlayers: z.number().int().min(2).max(30).default(4),
  mode: z.enum(["online", "tournament"]).default("online"),
  // Retry key. A client that resends after a lost response gets its original
  // room back instead of stranding the first one.
  operationId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  if (!isSupabaseServerConfigured()) {
    return jsonResponse(
      { error: "Online play is not configured on this server.", code: "not_configured" },
      503,
    );
  }
  const key = clientKey(req, "create-room");
  const tooMany = { error: "Too many rooms created — please wait a minute.", code: "rate_limited" };
  // In-memory first (free), then the shared limit that survives cold starts —
  // this endpoint is unauthenticated and every call leaves durable rows behind.
  if (!rateLimit(key, 10)) return jsonResponse(tooMany, 429);
  if (!(await rateLimitDurable(key, 10))) return jsonResponse(tooMany, 429);
  try {
    const body = bodySchema.parse(await req.json());
    const result = await createRoom(
      { name: body.name, avatar: body.avatar, color: body.color, sessionId: body.sessionId },
      body.maxPlayers,
      body.mode,
      body.operationId,
    );
    return jsonResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}
