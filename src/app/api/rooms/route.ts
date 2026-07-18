import { NextResponse } from "next/server";
import { z } from "zod";
import { createRoom } from "@/features/online/server";
import { errorResponse } from "@/features/online/http";
import { isSupabaseServerConfigured } from "@/lib/supabase/admin";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { displayNameSchema } from "@/lib/validation";
import { PLAYER_AVATARS, PLAYER_COLORS } from "@/types/game";

const avatarSchema = z.enum(PLAYER_AVATARS as [string, ...string[]]);
const colorSchema = z.enum(PLAYER_COLORS as [string, ...string[]]);

const bodySchema = z.object({
  name: displayNameSchema,
  avatar: avatarSchema,
  color: colorSchema,
  sessionId: z.string().uuid(),
  maxPlayers: z.number().int().min(2).max(4).default(4),
});

export async function POST(req: Request) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: "Online play is not configured on this server.", code: "not_configured" },
      { status: 503 },
    );
  }
  if (!rateLimit(clientKey(req, "create-room"), 10)) {
    return NextResponse.json(
      { error: "Too many rooms created — please wait a minute.", code: "rate_limited" },
      { status: 429 },
    );
  }
  try {
    const body = bodySchema.parse(await req.json());
    const result = await createRoom(
      { name: body.name, avatar: body.avatar, color: body.color, sessionId: body.sessionId },
      body.maxPlayers,
    );
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
