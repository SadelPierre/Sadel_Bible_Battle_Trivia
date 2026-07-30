"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RoomSnapshot } from "@/features/online/types";
import { roomActions, type RoomCredentials } from "@/features/online/client";
import { AVATAR_EMOJI, MIN_TOURNAMENT_PLAYERS, type GameSettings } from "@/types/game";
import { PLAYER_COLOR_STYLES } from "@/lib/playerColors";
import { DUR, EASE_OUT } from "@/lib/motion";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/shared/Button";
import { CopyLabel } from "@/components/shared/CopyLabel";
import { GameSettingsForm } from "@/components/settings/GameSettingsForm";

/** Lobby for a knockout tournament: scales to 30 seats and starts on headcount. */
export function TournamentLobby({
  snapshot,
  creds,
  onLeft,
  refresh,
}: {
  snapshot: RoomSnapshot;
  creds: RoomCredentials;
  onLeft: () => void;
  refresh: () => Promise<void>;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const firstPaint = useRef(true);
  useEffect(() => {
    firstPaint.current = false;
  }, []);

  const isHost = snapshot.hostPlayerId === snapshot.myPlayerId;
  const count = snapshot.players.length;
  const canStart = count >= MIN_TOURNAMENT_PLAYERS;
  const inviteLink =
    typeof window !== "undefined"
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/online?code=${snapshot.code}`
      : "";

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const addBots = (n: number, difficulty: "easy" | "medium" | "hard") =>
    run(async () => {
      const room = snapshot.maxPlayers - count;
      for (let i = 0; i < Math.min(n, room); i++) {
        await roomActions.addBot(snapshot.code, creds, difficulty);
      }
    });

  const copy = (what: "code" | "link", text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Card className="border-bbl-gold/40 bg-bbl-gold/5 p-5 text-center">
        <p className="text-sm font-bold text-bbl-muted">🏆 Tournament room code</p>
        <p className="mt-1 text-5xl font-black tracking-[0.25em] text-bbl-gold bbl-glow-gold">
          {snapshot.code}
        </p>
        <p className="mx-auto mt-2 max-w-md text-xs text-bbl-muted">
          Everyone answers the same questions. The lowest scorers are eliminated each round until
          the final two face off in a sudden-death duel for the crown.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => copy("code", snapshot.code)}>
            <CopyLabel copied={copied === "code"} idle="📋 Copy code" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => copy("link", inviteLink)}>
            <CopyLabel copied={copied === "link"} idle="🔗 Copy invite link" />
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-bold">
          Competitors <span className="text-bbl-gold">({count}/{snapshot.maxPlayers})</span>
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {snapshot.players.map((p, i) => {
              const c = PLAYER_COLOR_STYLES[p.color];
              return (
                <motion.div
                  layout
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{
                    duration: DUR.fast,
                    ease: EASE_OUT,
                    // First paint staggers across the field; a seat filled later
                    // animates on its own with no queue in front of it.
                    delay: firstPaint.current ? Math.min(i * 0.02, 0.4) : 0,
                  }}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${c.bg} ${c.border}`}
                >
                  <span aria-hidden>{AVATAR_EMOJI[p.avatar]}</span>
                  <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${c.text}`}>
                    {p.name}
                    {p.id === snapshot.myPlayerId && <span className="text-bbl-muted"> (you)</span>}
                  </span>
                  {p.isHost && <span className="text-xs" aria-label="Host">👑</span>}
                  {p.isBot && <span className="text-xs text-bbl-muted" aria-label="bot">🤖</span>}
                  {isHost && p.id !== snapshot.myPlayerId && (
                    <button
                      className="text-xs text-bbl-muted hover:text-bbl-incorrect"
                      aria-label={`Remove ${p.name}`}
                      onClick={() => run(() => roomActions.removePlayer(snapshot.code, creds, p.id))}
                    >
                      ✕
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {isHost && count < snapshot.maxPlayers && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-bbl-border pt-3">
            <span className="text-sm text-bbl-muted">Fill seats with bots:</span>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => addBots(1, "medium")}>
              🤖 +1
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => addBots(5, "medium")}>
              🤖 +5
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => addBots(snapshot.maxPlayers - count, "medium")}>
              🤖 Fill to {snapshot.maxPlayers}
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-bold">Question settings {!isHost && "(set by the host)"}</h2>
        {isHost ? (
          <>
            <GameSettingsForm
              settings={snapshot.settings}
              onChange={(s: GameSettings) => run(() => roomActions.settings(snapshot.code, creds, s))}
            />
            <p className="mt-2 text-xs text-bbl-muted">
              The number of questions is set automatically to fit the bracket.
            </p>
          </>
        ) : (
          <p className="text-sm text-bbl-muted">
            {snapshot.settings.timerSeconds}s per question · {snapshot.settings.difficulty} difficulty ·{" "}
            {snapshot.settings.scoringStyle} scoring
          </p>
        )}
      </Card>

      {actionError && (
        <p role="alert" className="rounded-xl border border-bbl-incorrect/50 bg-bbl-incorrect/10 p-3 text-sm font-semibold text-bbl-incorrect">
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {isHost ? (
          <Button
            variant="gold"
            size="lg"
            disabled={!canStart || busy}
            onClick={() => run(() => roomActions.start(snapshot.code, creds))}
          >
            ▶ Start tournament
          </Button>
        ) : (
          <span className="self-center text-sm text-bbl-muted">
            Waiting for the host to start the tournament…
          </span>
        )}
        {confirmLeave ? (
          <span className="inline-flex items-center gap-2">
            <span className="text-sm text-bbl-muted">Leave?</span>
            <Button
              variant="danger"
              size="sm"
              onClick={() =>
                run(async () => {
                  await roomActions.leave(snapshot.code, creds);
                  onLeft();
                })
              }
            >
              Yes, leave
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmLeave(false)}>
              Stay
            </Button>
          </span>
        ) : (
          <Button variant="ghost" size="lg" onClick={() => setConfirmLeave(true)}>
            🚪 Leave
          </Button>
        )}
      </div>
      {isHost && !canStart && (
        <p className="text-center text-xs text-bbl-muted">
          Need at least {MIN_TOURNAMENT_PLAYERS} competitors — invite people or add bots to start.
        </p>
      )}
    </div>
  );
}
