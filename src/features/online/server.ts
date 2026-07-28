import "server-only";

import { randomUUID } from "node:crypto";

/**
 * Server-authoritative online room manager.
 *
 * Every mutation follows the same shape:
 *   1. load room + players (+ current game)
 *   2. "settle" the game clock (countdown finished? bots due? timer expired?
 *      reveal over?) — the engine reducer runs HERE, on the server
 *   3. apply the requested action
 *   4. persist with an optimistic-concurrency check (version = seen version)
 *   5. insert a sync event so clients refetch
 *
 * Because Vercel functions are request-driven, time-based transitions happen
 * lazily on the next poll — clients poll every couple of seconds during play,
 * so transitions land within ~1s of their scheduled time.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  allAnswered,
  createGame,
  createTournamentGame,
  currentQuestion,
  gameReducer,
  LATE_GRACE_MS,
} from "@/features/game-engine/engine";
import { buildSurvivorSchedule } from "@/features/tournament/tournament";
import { planBotAnswer, botName } from "@/features/computer-players/bots";
import { selectQuestions } from "@/features/questions/select";
import { ONLINE_QUESTION_BANK } from "@/features/questions/bank";
import { generateRoomCode, sanitizeName } from "@/lib/validation";
import {
  DEFAULT_SETTINGS,
  DUEL_WINS_TO_WIN,
  MAX_TOURNAMENT_PLAYERS,
  MIN_TOURNAMENT_PLAYERS,
  PLAYER_AVATARS,
  PLAYER_COLORS,
  type BotDifficulty,
  type GameMode,
  type GamePlayer,
  type GameSettings,
  type GameState,
  type PlayerAvatar,
  type PlayerColor,
} from "@/types/game";
import type { GameSnapshot, RoomSnapshot, SnapshotPlayer, TournamentSnapshot } from "./types";

const CONNECTED_WINDOW_MS = 20_000; // heartbeat freshness → "connected"
const HOST_MIGRATE_AFTER_MS = 45_000;
const REVEAL_AUTO_ADVANCE_GRACE_MS = 1_500;

export class RoomError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code: string = "bad_request",
  ) {
    super(message);
  }
}

type RoomRow = {
  id: string;
  room_code: string;
  host_player_id: string | null;
  status: string;
  game_mode: GameMode;
  max_players: number;
  settings: GameSettings;
  current_game_id: string | null;
  version: number;
  expires_at: string;
};

type PlayerRow = {
  id: string;
  room_id: string;
  session_id: string | null;
  token: string;
  operation_id: string | null;
  display_name: string;
  avatar: string;
  player_color: string;
  is_host: boolean;
  is_ready: boolean;
  is_computer: boolean;
  computer_difficulty: string | null;
  joined_at: string;
  last_seen_at: string;
};

/** Bot answers are planned when a question starts and applied when due. */
type BotPlans = { forIndex: number; plans: Record<string, { answerIndex: number; at: number }> };

type GameDoc = {
  engine: GameState;
  botPlans: BotPlans | null;
  usedQuestionIds: string[];
};

/** A row from the contention-free tournament answer inbox, awaiting a fold. */
type InboxRow = {
  player_id: string;
  answer_index: number;
  response_ms: number;
  submitted_at: string;
};

type Ctx = {
  db: SupabaseClient;
  room: RoomRow;
  players: PlayerRow[];
  gameDoc: GameDoc | null;
  /** tournament answers for the current live question, drained at load time */
  inboxAnswers: InboxRow[];
  gameDirty: boolean;
  roomDirty: boolean;
};

// ── helpers ─────────────────────────────────────────────────────

function isConnected(p: PlayerRow, now: number): boolean {
  return p.is_computer || now - new Date(p.last_seen_at).getTime() < CONNECTED_WINDOW_MS;
}

function toGamePlayer(p: PlayerRow, now: number): GamePlayer {
  return {
    id: p.id,
    name: p.display_name,
    avatar: (PLAYER_AVATARS as string[]).includes(p.avatar)
      ? (p.avatar as PlayerAvatar)
      : "dove",
    color: (PLAYER_COLORS as string[]).includes(p.player_color)
      ? (p.player_color as PlayerColor)
      : "royal",
    isBot: p.is_computer,
    botDifficulty: (p.computer_difficulty as BotDifficulty | null) ?? undefined,
    connected: isConnected(p, now),
  };
}

async function loadCtx(db: SupabaseClient, code: string): Promise<Ctx> {
  const { data: room, error } = await db
    .from("game_rooms")
    .select("*")
    .eq("room_code", code)
    .maybeSingle();
  if (error) throw new RoomError(error.message, 500, "db_error");
  if (!room) throw new RoomError("Room not found. Check the code and try again.", 404, "not_found");
  if (new Date(room.expires_at).getTime() < Date.now() || room.status === "abandoned") {
    throw new RoomError("This room has expired.", 410, "expired");
  }
  const { data: players, error: pErr } = await db
    .from("room_players")
    .select("*")
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });
  if (pErr) throw new RoomError(pErr.message, 500, "db_error");

  let gameDoc: GameDoc | null = null;
  if (room.current_game_id) {
    const { data: game } = await db
      .from("games")
      .select("state")
      .eq("id", room.current_game_id)
      .maybeSingle();
    if (game?.state) gameDoc = game.state as GameDoc;
  }

  // For a live tournament question, pull the inbox so the settle pass can fold
  // the answers into authoritative state in one batched commit. Reading the
  // inbox never touches game_rooms.version, so the answer write path stays
  // contention-free no matter how many players submit at once.
  let inboxAnswers: InboxRow[] = [];
  if (
    room.game_mode === "tournament" &&
    room.current_game_id &&
    gameDoc &&
    gameDoc.engine.phase === "question"
  ) {
    const { data: rows, error: inboxErr } = await db.rpc("drain_tournament_answers", {
      p_game_id: room.current_game_id,
      p_question_index: gameDoc.engine.currentIndex,
    });
    // A failed read must never be mistaken for "nobody answered" — that would
    // advance the question and score every submitted answer as a miss.
    if (inboxErr) throw new RoomError(inboxErr.message, 500, "db_error");
    if (rows) inboxAnswers = rows as InboxRow[];
  }

  return {
    db,
    room: room as RoomRow,
    players: (players ?? []) as PlayerRow[],
    gameDoc,
    inboxAnswers,
    gameDirty: false,
    roomDirty: false,
  };
}

type AnswerAuditRow = {
  question_index: number;
  question_id: string;
  player_id: string;
  selected_answer_index: number | null;
  is_correct: boolean;
  response_time_ms: number | null;
  base_points: number;
  speed_bonus: number;
  streak_bonus: number;
  total_points: number;
  submitted_at: string | null;
};

function currentAnswerAudit(ctx: Ctx): AnswerAuditRow[] | null {
  const gameId = ctx.room.current_game_id;
  const doc = ctx.gameDoc;
  if (!gameId || !doc || doc.engine.phase === "countdown" || doc.engine.phase === "question") {
    return null;
  }
  const { engine } = doc;
  const question = engine.questions[engine.currentIndex];
  if (!question) return null;

  return engine.players.flatMap((player) => {
    const record = engine.scores[player.id]?.answers[engine.currentIndex];
    if (!record) return [];
    const pending = engine.pendingAnswers[player.id];
    return [
      {
        question_index: engine.currentIndex,
        question_id: question.id,
        player_id: player.id,
        selected_answer_index: record.answerIndex,
        is_correct: record.isCorrect,
        response_time_ms: record.responseMs,
        base_points: record.basePoints,
        speed_bonus: record.speedBonus,
        streak_bonus: record.streakBonus,
        total_points: record.totalPoints,
        submitted_at: pending ? new Date(pending.submittedAt).toISOString() : null,
      },
    ];
  });
}

/**
 * Atomically persist the room version, full engine document, answer audit, and
 * Realtime sync event. A null result means another request won the version race.
 */
async function saveCtx(ctx: Ctx): Promise<boolean> {
  const { db, room } = ctx;
  const gameState = ctx.gameDirty && ctx.gameDoc ? ctx.gameDoc : null;
  const completedAt =
    gameState?.engine.phase === "complete" ? new Date().toISOString() : null;
  const { data, error } = await db.rpc("commit_room_state", {
    p_room_id: room.id,
    p_expected_version: room.version,
    p_host_player_id: room.host_player_id,
    p_status: room.status,
    p_settings: room.settings,
    p_current_game_id: room.current_game_id,
    p_game_state: gameState,
    p_question_ids: gameState?.engine.questions.map((question) => question.id) ?? null,
    p_answer_rows: gameState ? currentAnswerAudit(ctx) : null,
    p_completed_at: completedAt,
  });
  if (error) throw new RoomError(error.message, 500, "db_error");
  if (data === null || data === undefined) return false;
  room.version = Number(data);
  return true;
}

// ── the settle pass: advance authoritative time ────────────────

function planBots(ctx: Ctx, now: number): void {
  const doc = ctx.gameDoc;
  if (!doc || doc.engine.phase !== "question") return;
  if (doc.botPlans && doc.botPlans.forIndex === doc.engine.currentIndex) return;
  const question = currentQuestion(doc.engine);
  const timerMs = doc.engine.settings.timerSeconds * 1000;
  const plans: BotPlans = { forIndex: doc.engine.currentIndex, plans: {} };
  for (const p of doc.engine.players) {
    if (!p.isBot) continue;
    const plan = planBotAnswer(p.botDifficulty ?? "medium", question, timerMs);
    plans.plans[p.id] = { answerIndex: plan.answerIndex, at: now + plan.delayMs };
  }
  doc.botPlans = plans;
  ctx.gameDirty = true;
}

/** Online deadlines retain the reducer's small latency allowance. */
export function shouldRevealOnline(state: GameState, now: number): boolean {
  if (state.phase !== "question") return false;
  if (allAnswered(state)) return true;
  return state.questionDeadline !== null && now >= state.questionDeadline + LATE_GRACE_MS;
}

/**
 * Fold inbox answers into authoritative pending answers.
 *
 * Idempotent: a player who already has a pending answer is skipped, so racing
 * settle passes converge on the same set. Returns null when nothing changed.
 */
function foldInboxAnswers(engine: GameState, rows: InboxRow[]): GameState | null {
  if (rows.length === 0) return null;
  const pending = { ...engine.pendingAnswers };
  let folded = false;
  for (const row of rows) {
    if (pending[row.player_id] !== undefined) continue;
    if (!engine.players.some((p) => p.id === row.player_id)) continue;
    if (engine.tournament?.eliminatedAtIndex[row.player_id] !== undefined) continue;
    pending[row.player_id] = {
      answerIndex: row.answer_index,
      responseMs: row.response_ms,
      submittedAt: new Date(row.submitted_at).getTime(),
    };
    folded = true;
  }
  return folded ? { ...engine, pendingAnswers: pending } : null;
}

/**
 * Close a tournament question and return its final answer set.
 *
 * The database takes an exclusive lock on the game row, waits for every
 * in-flight submission to commit, and refuses any that starts afterwards. The
 * old code read the inbox and revealed in two separate steps, so an answer
 * landing in between was accepted by the API and then silently dropped.
 */
async function closeTournamentQuestion(ctx: Ctx, questionIndex: number): Promise<InboxRow[]> {
  const { data, error } = await ctx.db.rpc("close_tournament_question", {
    p_game_id: ctx.room.current_game_id,
    p_question_index: questionIndex,
  });
  if (error) throw new RoomError(error.message, 500, "db_error");
  return (data ?? []) as InboxRow[];
}

/**
 * Run all due time-based transitions. Loops until stable.
 *
 * `canClose` is false for callers that only want an accurate in-memory clock
 * and will not persist the result: closing a question is a durable decision,
 * so it belongs to the paths that commit.
 */
async function settleGame(ctx: Ctx, now: number, canClose = true): Promise<void> {
  const doc = ctx.gameDoc;
  if (!doc) return;
  const isTournament = ctx.room.game_mode === "tournament" && Boolean(ctx.room.current_game_id);
  let engine = doc.engine;
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 50) {
    changed = false;

    if (engine.phase === "countdown" && engine.phaseEndsAt !== null && now >= engine.phaseEndsAt) {
      engine = gameReducer(engine, { type: "COUNTDOWN_FINISHED", now: engine.phaseEndsAt });
      doc.engine = engine;
      ctx.gameDirty = true;
      planBots(ctx, engine.questionStartedAt ?? now);
      changed = true;
      continue;
    }

    if (engine.phase === "question") {
      // Fold any inbox answers (tournament humans) into authoritative state.
      const folded = foldInboxAnswers(engine, ctx.inboxAnswers);
      if (folded) {
        engine = folded;
        doc.engine = engine;
        ctx.gameDirty = true;
        changed = true;
      }
      planBots(ctx, now);
      // apply bot answers that are due
      const plans = doc.botPlans;
      if (plans && plans.forIndex === engine.currentIndex) {
        for (const [botId, plan] of Object.entries(plans.plans)) {
          if (plan.at <= now && engine.pendingAnswers[botId] === undefined) {
            const next = gameReducer(engine, {
              type: "SUBMIT_ANSWER",
              playerId: botId,
              answerIndex: plan.answerIndex,
              now: plan.at,
            });
            if (next !== engine) {
              engine = next;
              doc.engine = engine;
              ctx.gameDirty = true;
              changed = true;
            }
          }
        }
      }
      if (shouldRevealOnline(engine, now)) {
        if (isTournament) {
          // Leave the reveal to a caller that will persist it, so the durable
          // "question closed" marker and the engine state agree.
          if (!canClose) break;
          const finalRows = await closeTournamentQuestion(ctx, engine.currentIndex);
          ctx.inboxAnswers = finalRows;
          const lastCall = foldInboxAnswers(engine, finalRows);
          if (lastCall) {
            engine = lastCall;
            doc.engine = engine;
            ctx.gameDirty = true;
          }
        }
        engine = gameReducer(engine, { type: "LOCK_AND_REVEAL", now });
        doc.engine = engine;
        ctx.gameDirty = true;
        changed = true;
      }
      continue;
    }

    if (
      (engine.phase === "reveal" || engine.phase === "round-summary") &&
      engine.phaseEndsAt !== null &&
      now >= engine.phaseEndsAt + REVEAL_AUTO_ADVANCE_GRACE_MS
    ) {
      engine = gameReducer(engine, { type: "ADVANCE", now });
      doc.engine = engine;
      ctx.gameDirty = true;
      planBots(ctx, now);
      changed = true;
      continue;
    }
  }

  if (engine.phase === "complete" && ctx.room.status === "playing") {
    ctx.room.status = "complete";
    ctx.roomDirty = true;
  }
}

/** Host gone too long? Give the crown to the longest-connected human. */
function settleHost(ctx: Ctx, now: number): void {
  const humans = ctx.players.filter((p) => !p.is_computer);
  if (humans.length === 0) return;
  const host = ctx.players.find((p) => p.id === ctx.room.host_player_id);
  const hostStale =
    !host ||
    host.is_computer ||
    now - new Date(host.last_seen_at).getTime() > HOST_MIGRATE_AFTER_MS;
  if (!hostStale) return;
  const candidate = humans
    .filter((p) => isConnected(p, now))
    .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())[0];
  if (candidate && candidate.id !== ctx.room.host_player_id) {
    ctx.room.host_player_id = candidate.id;
    ctx.roomDirty = true;
  }
}

// ── retryable mutation wrapper ──────────────────────────────────

async function withRoom<T>(
  code: string,
  fn: (ctx: Ctx, now: number) => Promise<T> | T,
): Promise<T> {
  const db = supabaseAdmin();
  for (let attempt = 0; attempt < 4; attempt++) {
    const ctx = await loadCtx(db, code);
    const now = Date.now();
    settleHost(ctx, now);
    await settleGame(ctx, now);
    const result = await fn(ctx, now);
    // pure reads (no dirty flags) never bump the version or notify — otherwise
    // every poll would trigger a refetch storm
    if (!ctx.roomDirty && !ctx.gameDirty) return result;
    if (await saveCtx(ctx)) return result;
    // another request mutated the room concurrently — reload and retry
  }
  throw new RoomError("The room is busy — please try again.", 409, "conflict");
}

// ── auth ────────────────────────────────────────────────────────

export function requirePlayer(ctx: Ctx, playerId: string, token: string): PlayerRow {
  const player = ctx.players.find((p) => p.id === playerId && p.token === token);
  if (!player) throw new RoomError("You are not a player in this room.", 403, "forbidden");
  return player;
}

function requireHost(ctx: Ctx, playerId: string, token: string): PlayerRow {
  const player = requirePlayer(ctx, playerId, token);
  if (ctx.room.host_player_id !== player.id) {
    throw new RoomError("Only the host can do that.", 403, "not_host");
  }
  return player;
}

function uniqueName(ctx: Ctx, raw: string): string {
  let name = sanitizeName(raw) || "Player";
  const taken = new Set(ctx.players.map((p) => p.display_name.toLowerCase()));
  while (taken.has(name.toLowerCase())) name = `${name} ✦`.slice(0, 24);
  return name;
}

function pickColor(ctx: Ctx, wanted: string): PlayerColor {
  const taken = new Set(ctx.players.map((p) => p.player_color));
  if ((PLAYER_COLORS as string[]).includes(wanted) && !taken.has(wanted)) {
    return wanted as PlayerColor;
  }
  return PLAYER_COLORS.find((c) => !taken.has(c)) ?? "royal";
}

function playerInsertError(error: { code?: string; message: string }): RoomError {
  if (error.message.includes("room_full")) {
    return new RoomError("This room is full.", 409, "room_full");
  }
  if (error.message.includes("room_not_joinable")) {
    return new RoomError("This game has already started.", 409, "already_started");
  }
  return new RoomError(error.message, 500, "db_error");
}

// ── public API used by the routes ───────────────────────────────

export type Identity = { name: string; avatar: string; color: string; sessionId: string };

type CreatedRoom = { room_code: string; player_id: string; player_token: string };

/**
 * Create a room and seat its host.
 *
 * One database transaction: previously this was three independent writes, so a
 * failure could leave a room with no players or no host, and a lost response
 * left the user pressing the button again and getting a second room. The
 * caller's `operationId` makes a retry return the room the first attempt made.
 */
export async function createRoom(
  identity: Identity,
  maxPlayers: number,
  mode: GameMode = "online",
  operationId: string = randomUUID(),
) {
  const db = supabaseAdmin();
  const floor = mode === "tournament" ? MIN_TOURNAMENT_PLAYERS : 2;
  const cap = mode === "tournament" ? MAX_TOURNAMENT_PLAYERS : 4;
  const clampedMax = Math.min(cap, Math.max(floor, maxPlayers));
  // retry on the (unlikely) code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db.rpc("create_room_with_host", {
      p_room_code: generateRoomCode(),
      p_game_mode: mode,
      p_max_players: clampedMax,
      p_settings: DEFAULT_SETTINGS,
      p_operation_id: operationId,
      p_session_id: identity.sessionId,
      p_display_name: sanitizeName(identity.name) || "Host",
      p_avatar: identity.avatar,
      p_player_color: identity.color,
    });
    if (error) {
      // Either the room code collided, or a concurrent request with the same
      // operation id won. Both are resolved by trying again: the next attempt
      // finds the existing seat and returns it.
      if (error.code === "23505") continue;
      throw playerInsertError(error);
    }
    const room = (Array.isArray(data) ? data[0] : data) as CreatedRoom | undefined;
    if (!room) continue;
    void sweepExpiredRooms(db);
    return { code: room.room_code, playerId: room.player_id, token: room.player_token };
  }
  throw new RoomError("Could not create a room. Please try again.", 500, "room_create_failed");
}

/**
 * Opportunistic retention sweep, sampled so it costs roughly one extra query
 * per ten rooms. pg_cron does this on a schedule where it is available; this
 * keeps a project without it from accumulating expired rooms forever.
 */
function sweepExpiredRooms(db: SupabaseClient): void {
  if (Math.random() > 0.1) return;
  void db.rpc("cleanup_expired_rooms").then(({ error }) => {
    if (error) console.error("cleanup_expired_rooms failed:", error.message);
  });
}

export async function joinRoom(code: string, identity: Identity) {
  return withRoom(code, async (ctx) => {
    // reconnect path: same browser session returns to its seat
    const existing = ctx.players.find(
      (p) => !p.is_computer && p.session_id === identity.sessionId,
    );
    if (existing) {
      await ctx.db
        .from("room_players")
        .update({ last_seen_at: new Date().toISOString(), connection_status: "connected" })
        .eq("id", existing.id);
      return { code: ctx.room.room_code, playerId: existing.id, token: existing.token };
    }
    if (ctx.room.status !== "lobby") {
      throw new RoomError("This game has already started.", 409, "already_started");
    }
    if (ctx.players.length >= ctx.room.max_players) {
      throw new RoomError("This room is full.", 409, "room_full");
    }
    const { data: player, error } = await ctx.db
      .from("room_players")
      .insert({
        room_id: ctx.room.id,
        session_id: identity.sessionId,
        display_name: uniqueName(ctx, identity.name),
        avatar: identity.avatar,
        player_color: pickColor(ctx, identity.color),
        is_host: false,
      })
      .select("*")
      .single();
    if (error?.code === "23505") {
      // Two reconnect/join requests from the same browser may race. The unique
      // (room_id, session_id) index makes one win; return that seat to the loser.
      const { data: racedPlayer } = await ctx.db
        .from("room_players")
        .select("id, token")
        .eq("room_id", ctx.room.id)
        .eq("session_id", identity.sessionId)
        .maybeSingle();
      if (racedPlayer) {
        return {
          code: ctx.room.room_code,
          playerId: racedPlayer.id as string,
          token: racedPlayer.token as string,
        };
      }
    }
    if (error) throw playerInsertError(error);
    // The membership trigger atomically bumps the room version and notifies.
    return { code: ctx.room.room_code, playerId: player.id as string, token: player.token as string };
  });
}

export async function heartbeatAndSnapshot(
  code: string,
  playerId: string | null,
  token: string | null,
): Promise<RoomSnapshot> {
  return withRoom(code, async (ctx, now) => {
    if (playerId && token) {
      const me = ctx.players.find((p) => p.id === playerId && p.token === token);
      if (me) {
        me.last_seen_at = new Date(now).toISOString();
        await ctx.db
          .from("room_players")
          .update({ last_seen_at: me.last_seen_at, connection_status: "connected" })
          .eq("id", me.id);
      }
    }
    return buildSnapshot(ctx, now, playerId, token);
  });
}

export async function setReady(code: string, playerId: string, token: string, ready: boolean) {
  return withRoom(code, async (ctx) => {
    const me = requirePlayer(ctx, playerId, token);
    if (me.is_ready === ready) return;
    const { error } = await ctx.db
      .from("room_players")
      .update({ is_ready: ready })
      .eq("id", me.id);
    if (error) throw new RoomError(error.message, 500, "db_error");
    // The readiness trigger bumps the room version and emits the sync event.
  });
}

export async function updateSettings(
  code: string,
  playerId: string,
  token: string,
  settings: GameSettings,
) {
  return withRoom(code, (ctx) => {
    requireHost(ctx, playerId, token);
    if (ctx.room.status !== "lobby") throw new RoomError("Game already started.", 409, "already_started");
    ctx.room.settings = settings;
    ctx.roomDirty = true;
  });
}

export async function addBot(code: string, playerId: string, token: string, difficulty: BotDifficulty) {
  const operationId = randomUUID();
  return withRoom(code, async (ctx) => {
    requireHost(ctx, playerId, token);
    if (ctx.room.status !== "lobby") throw new RoomError("Game already started.", 409, "already_started");
    // The first insert may have succeeded before a concurrent room-version
    // conflict forced withRoom to retry. Do not add the same bot twice.
    if (ctx.players.some((player) => player.operation_id === operationId)) return;
    if (ctx.players.length >= ctx.room.max_players) {
      throw new RoomError("The room is full.", 409, "room_full");
    }
    const botIndex = ctx.players.filter((p) => p.is_computer).length;
    const { error } = await ctx.db.from("room_players").insert({
      room_id: ctx.room.id,
      operation_id: operationId,
      display_name: uniqueName(ctx, botName(botIndex)),
      avatar: ["scroll", "lamp", "star", "harp"][botIndex % 4],
      player_color: pickColor(ctx, ""),
      is_computer: true,
      computer_difficulty: difficulty,
      is_ready: true,
    });
    if (error) throw playerInsertError(error);
    // The membership trigger atomically bumps the room version and notifies.
  });
}

export async function removePlayer(
  code: string,
  playerId: string,
  token: string,
  targetId: string,
) {
  let removedOnce = false;
  return withRoom(code, async (ctx) => {
    const me = requirePlayer(ctx, playerId, token);
    const isSelf = targetId === me.id;
    if (!isSelf && ctx.room.host_player_id !== me.id) {
      throw new RoomError("Only the host can remove other players.", 403, "not_host");
    }
    const target = ctx.players.find((p) => p.id === targetId);
    if (!target) {
      if (!removedOnce) return;
      // The delete trigger invalidated our first snapshot. Reapply only the
      // authoritative host/status/game changes against the reloaded context.
      const humansLeft = ctx.players.filter((player) => !player.is_computer);
      if (humansLeft.length === 0) ctx.room.status = "abandoned";
      if (ctx.gameDoc) {
        ctx.gameDoc.engine = {
          ...ctx.gameDoc.engine,
          players: ctx.gameDoc.engine.players.map((player) =>
            player.id === targetId ? { ...player, connected: false } : player,
          ),
        };
        ctx.gameDirty = true;
      }
      ctx.roomDirty = true;
      return;
    }
    const { error } = await ctx.db.from("room_players").delete().eq("id", target.id);
    if (error) throw new RoomError(error.message, 500, "db_error");
    removedOnce = true;
    ctx.players = ctx.players.filter((p) => p.id !== target.id);

    const humansLeft = ctx.players.filter((p) => !p.is_computer);
    if (humansLeft.length === 0) {
      ctx.room.status = "abandoned";
    } else if (ctx.room.host_player_id === target.id) {
      ctx.room.host_player_id = humansLeft[0]!.id;
    }
    // during a match, mark the leaver disconnected in the engine so the round
    // doesn't wait for them
    if (ctx.gameDoc) {
      ctx.gameDoc.engine = {
        ...ctx.gameDoc.engine,
        players: ctx.gameDoc.engine.players.map((p) =>
          p.id === targetId ? { ...p, connected: false } : p,
        ),
      };
      ctx.gameDirty = true;
    }
    ctx.roomDirty = true;
  });
}

function beginGame(ctx: Ctx, now: number, excludeIds: string[]): void {
  const isTournament = ctx.room.game_mode === "tournament";
  const players = ctx.players.map((p) => toGamePlayer(p, now));
  let settings = { ...DEFAULT_SETTINGS, ...ctx.room.settings };
  if (isTournament) {
    // A tournament must have enough questions for every field cut plus a
    // full-length duel, and never breaks for a round summary.
    const needed = buildSurvivorSchedule(players.length).length + DUEL_WINS_TO_WIN * 2 + 2;
    settings = { ...settings, questionCount: Math.max(settings.questionCount, needed), roundSize: 0 };
  }
  const questions = selectQuestions(ONLINE_QUESTION_BANK, settings, new Set(excludeIds));
  const engine = isTournament
    ? createTournamentGame(settings, players, questions, now)
    : createGame(settings, players, questions, now);
  ctx.gameDoc = {
    engine,
    botPlans: null,
    usedQuestionIds: [...excludeIds, ...questions.map((q) => q.id)],
  };
  ctx.gameDirty = true;
  ctx.room.status = "playing";
  ctx.roomDirty = true;
}

export async function startGame(code: string, playerId: string, token: string) {
  return withRoom(code, async (ctx, now) => {
    requireHost(ctx, playerId, token);
    if (ctx.room.status !== "lobby") throw new RoomError("Game already started.", 409, "already_started");

    if (ctx.room.game_mode === "tournament") {
      // A large field can't wait on everyone tapping Ready — the host starts the
      // bracket once enough players have joined. Anyone still in the lobby at
      // start is simply in the field.
      if (ctx.players.length < MIN_TOURNAMENT_PLAYERS) {
        throw new RoomError(
          `A tournament needs at least ${MIN_TOURNAMENT_PLAYERS} players.`,
          400,
          "not_enough_players",
        );
      }
    } else {
      const humans = ctx.players.filter((p) => !p.is_computer);
      if (ctx.players.length < 2) {
        throw new RoomError("You need at least 2 players (add a computer player?).", 400, "not_enough_players");
      }
      const notReady = humans.filter((p) => !p.is_ready && p.id !== ctx.room.host_player_id);
      if (notReady.length > 0) {
        throw new RoomError(
          `Waiting for: ${notReady.map((p) => p.display_name).join(", ")}`,
          409,
          "not_ready",
        );
      }
    }
    // The atomic commit RPC creates this row together with the room transition.
    ctx.room.current_game_id = randomUUID();
    beginGame(ctx, now, []);
  });
}

export async function submitAnswer(
  code: string,
  playerId: string,
  token: string,
  answerIndex: number,
) {
  const db = supabaseAdmin();
  const ctx = await loadCtx(db, code);

  // Tournament: write to the answer inbox instead of mutating the room. This is
  // the one path that must scale to 30 simultaneous submitters, so it never
  // touches game_rooms.version — the settle pass folds these in later.
  if (ctx.room.game_mode === "tournament") {
    const now = Date.now();
    const me = requirePlayer(ctx, playerId, token);
    const doc = ctx.gameDoc;
    if (!doc) throw new RoomError("No game in progress.", 409, "no_game");
    // Advance authoritative time in memory (not persisted) so timing is accurate
    // even if no poll has settled the countdown→question transition yet.
    await settleGame(ctx, now, false);
    const engine = doc.engine;
    if (engine.phase !== "question") return; // not accepting answers right now
    if (engine.tournament?.eliminatedAtIndex[me.id] !== undefined) {
      throw new RoomError("You have been eliminated — you're spectating now.", 409, "eliminated");
    }
    if (answerIndex < 0 || answerIndex > 3) throw new RoomError("Invalid answer.", 400, "bad_answer");
    const started = engine.questionStartedAt ?? now;
    const deadline = engine.questionDeadline ?? now;
    if (now > deadline + LATE_GRACE_MS) return; // too late — silently ignore
    const responseMs = Math.max(0, Math.min(now - started, engine.settings.timerSeconds * 1000));
    const { error } = await ctx.db.rpc("submit_tournament_answer", {
      p_room_id: ctx.room.id,
      p_game_id: ctx.room.current_game_id,
      p_question_index: engine.currentIndex,
      p_player_id: me.id,
      p_answer_index: answerIndex,
      p_response_ms: responseMs,
    });
    if (error) throw new RoomError(error.message, 500, "db_error");
    return;
  }

  // Normal online (≤4 players): version-checked mutation with a settle pass, so
  // reveal happens instantly once everyone has answered.
  return withRoom(code, async (c, now) => {
    const me = requirePlayer(c, playerId, token);
    if (!c.gameDoc) throw new RoomError("No game in progress.", 409, "no_game");
    const before = c.gameDoc.engine;
    const after = gameReducer(before, {
      type: "SUBMIT_ANSWER",
      playerId: me.id,
      answerIndex,
      now,
    });
    if (after !== before) {
      c.gameDoc.engine = after;
      c.gameDirty = true;
      await settleGame(c, now);
    }
  });
}

export async function advancePhase(code: string, playerId: string, token: string) {
  return withRoom(code, (ctx, now) => {
    requireHost(ctx, playerId, token);
    if (!ctx.gameDoc) throw new RoomError("No game in progress.", 409, "no_game");
    const before = ctx.gameDoc.engine;
    const after = gameReducer(before, { type: "ADVANCE", now });
    if (after !== before) {
      ctx.gameDoc.engine = after;
      ctx.gameDirty = true;
      planBots(ctx, now);
    }
  });
}

export async function rematch(code: string, playerId: string, token: string) {
  return withRoom(code, async (ctx, now) => {
    requireHost(ctx, playerId, token);
    if (ctx.room.status !== "complete") {
      throw new RoomError("The current game is not finished.", 409, "not_complete");
    }
    const used = ctx.gameDoc?.usedQuestionIds ?? [];
    ctx.room.current_game_id = randomUUID();
    beginGame(ctx, now, used);
  });
}

export async function returnToLobby(code: string, playerId: string, token: string) {
  return withRoom(code, async (ctx) => {
    requireHost(ctx, playerId, token);
    ctx.room.status = "lobby";
    ctx.room.current_game_id = null;
    ctx.gameDoc = null;
    const { error } = await ctx.db
      .from("room_players")
      .update({ is_ready: false })
      .eq("room_id", ctx.room.id)
      .eq("is_computer", false)
      .eq("is_ready", true)
      .neq("id", ctx.room.host_player_id ?? "");
    if (error) throw new RoomError(error.message, 500, "db_error");
    ctx.roomDirty = true;
  });
}

// ── snapshots ───────────────────────────────────────────────────

function buildSnapshot(
  ctx: Ctx,
  now: number,
  playerId: string | null,
  token: string | null,
): RoomSnapshot {
  const me =
    playerId && token
      ? (ctx.players.find((p) => p.id === playerId && p.token === token) ?? null)
      : null;

  const players: SnapshotPlayer[] = ctx.players.map((p) => ({
    id: p.id,
    name: p.display_name,
    avatar: toGamePlayer(p, now).avatar,
    color: toGamePlayer(p, now).color,
    isHost: ctx.room.host_player_id === p.id,
    isReady: p.is_ready,
    isBot: p.is_computer,
    botDifficulty: (p.computer_difficulty as BotDifficulty | null) ?? undefined,
    connected: isConnected(p, now),
  }));

  let game: GameSnapshot | null = null;
  if (ctx.gameDoc) {
    const engine = ctx.gameDoc.engine;
    const q = engine.questions[engine.currentIndex] ?? null;
    const revealed = engine.phase !== "question" && engine.phase !== "countdown";
    // SECURITY: while the question is live, strip everything that gives the
    // answer away. Clients only learn the correct answer at reveal.
    const questionOut = q
      ? revealed
        ? q
        : {
            id: q.id,
            question: q.question,
            options: q.options,
            category: q.category,
            difficulty: q.difficulty,
            testament: q.testament,
            tags: q.tags,
            isReviewed: q.isReviewed,
          }
      : null;
    let tournament: TournamentSnapshot | null = null;
    if (engine.tournament) {
      const t = engine.tournament;
      const survivorCount = engine.players.filter(
        (p) => t.eliminatedAtIndex[p.id] === undefined,
      ).length;
      tournament = {
        stage: t.stage,
        survivorSchedule: t.survivorSchedule,
        survivorCount,
        nextCutTo:
          t.stage === "field" ? (t.survivorSchedule.find((s) => s < survivorCount) ?? null) : null,
        eliminatedAtIndex: t.eliminatedAtIndex,
        duelWins: t.duelWins,
        championId: t.championId,
        meEliminated: me ? t.eliminatedAtIndex[me.id] !== undefined : false,
      };
    }

    game = {
      phase: engine.phase,
      settings: engine.settings,
      currentIndex: engine.currentIndex,
      questionCount: engine.questions.length,
      questionStartedAt: engine.questionStartedAt,
      questionDeadline: engine.questionDeadline,
      phaseEndsAt: engine.phaseEndsAt,
      question: questionOut,
      revealed,
      answeredIds: Object.keys(engine.pendingAnswers),
      myAnswerIndex: me ? (engine.pendingAnswers[me.id]?.answerIndex ?? null) : null,
      scores: engine.scores,
      roundJustEnded: engine.roundJustEnded,
      winnerIds: engine.winnerIds,
      tournament,
    };
  }

  return {
    roomId: ctx.room.id,
    code: ctx.room.room_code,
    status: ctx.room.status as RoomSnapshot["status"],
    gameMode: ctx.room.game_mode,
    hostPlayerId: ctx.room.host_player_id,
    maxPlayers: ctx.room.max_players,
    settings: { ...DEFAULT_SETTINGS, ...ctx.room.settings },
    players,
    game,
    serverNow: now,
    version: ctx.room.version,
    myPlayerId: me?.id ?? null,
  };
}
