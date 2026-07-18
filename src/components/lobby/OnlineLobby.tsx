"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { RoomSnapshot } from "@/features/online/types";
import { roomActions, type RoomCredentials } from "@/features/online/client";
import { AVATAR_EMOJI, type GameSettings } from "@/types/game";
import { PLAYER_COLOR_STYLES } from "@/lib/playerColors";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/shared/Button";
import { GameSettingsForm } from "@/components/settings/GameSettingsForm";
import { CATEGORY_LABELS } from "@/types/game";

export function OnlineLobby({
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

  const me = snapshot.players.find((p) => p.id === snapshot.myPlayerId);
  const isHost = snapshot.hostPlayerId === snapshot.myPlayerId;
  const humans = snapshot.players.filter((p) => !p.isBot);
  const allReady = humans.every((p) => p.isReady || p.id === snapshot.hostPlayerId);
  const inviteLink =
    typeof window !== "undefined"
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/online?code=${snapshot.code}`
      : "";

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong.");
    }
  };

  const copy = (what: "code" | "link", text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Card className="p-5 text-center">
        <p className="text-sm font-bold text-bbl-muted">Room code</p>
        <p className="mt-1 text-5xl font-black tracking-[0.25em] text-bbl-gold bbl-glow-gold">
          {snapshot.code}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => copy("code", snapshot.code)}>
            {copied === "code" ? "Copied ✓" : "📋 Copy code"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => copy("link", inviteLink)}>
            {copied === "link" ? "Copied ✓" : "🔗 Copy invite link"}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-bold">
          Players ({snapshot.players.length}/{snapshot.maxPlayers})
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {snapshot.players.map((p, i) => {
            const c = PLAYER_COLOR_STYLES[p.color];
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-2 rounded-xl border p-3 ${c.bg} ${c.border}`}
              >
                <span className="text-xl" aria-hidden>
                  {AVATAR_EMOJI[p.avatar]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-bold ${c.text}`}>
                    {p.name}
                    {p.id === snapshot.myPlayerId && <span className="text-bbl-muted"> (you)</span>}
                  </p>
                  <p className="text-xs text-bbl-muted">
                    {p.isHost && <span className="font-bold text-bbl-gold">👑 Host · </span>}
                    {p.isBot ? (
                      <span>🤖 {p.botDifficulty} bot</span>
                    ) : p.connected ? (
                      <span className="text-bbl-correct">● online</span>
                    ) : (
                      <span>○ away</span>
                    )}
                    {" · "}
                    {p.isReady ? "✅ ready" : "…waiting"}
                  </p>
                </div>
                {isHost && p.id !== snapshot.myPlayerId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => run(() => roomActions.removePlayer(snapshot.code, creds, p.id))}
                  >
                    ✕
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>

        {isHost && snapshot.players.length < snapshot.maxPlayers && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-bbl-muted">Add computer player:</span>
            {(["easy", "medium", "hard"] as const).map((d) => (
              <Button
                key={d}
                variant="ghost"
                size="sm"
                onClick={() => run(() => roomActions.addBot(snapshot.code, creds, d))}
              >
                🤖 {d}
              </Button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-bold">Game settings {!isHost && "(set by the host)"}</h2>
        {isHost ? (
          <GameSettingsForm
            settings={snapshot.settings}
            onChange={(s: GameSettings) =>
              run(() => roomActions.settings(snapshot.code, creds, s))
            }
          />
        ) : (
          <p className="text-sm text-bbl-muted">
            {snapshot.settings.questionCount} questions · {snapshot.settings.timerSeconds}s each ·{" "}
            {snapshot.settings.difficulty} difficulty ·{" "}
            {snapshot.settings.categories === "mixed"
              ? "all categories"
              : snapshot.settings.categories.map((c) => CATEGORY_LABELS[c]).join(", ")}{" "}
            · {snapshot.settings.scoringStyle} scoring
          </p>
        )}
      </Card>

      {actionError && (
        <p role="alert" className="rounded-xl border border-bbl-incorrect/50 bg-bbl-incorrect/10 p-3 text-sm font-semibold text-bbl-incorrect">
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {!isHost && me && (
          <Button
            variant={me.isReady ? "ghost" : "gold"}
            size="lg"
            onClick={() => run(() => roomActions.ready(snapshot.code, creds, !me.isReady))}
          >
            {me.isReady ? "✋ Not ready" : "✅ I'm ready"}
          </Button>
        )}
        {isHost && (
          <Button
            variant="gold"
            size="lg"
            disabled={snapshot.players.length < 2 || !allReady}
            onClick={() => run(() => roomActions.start(snapshot.code, creds))}
          >
            ▶ Start game
          </Button>
        )}
        {confirmLeave ? (
          <span className="inline-flex items-center gap-2">
            <span className="text-sm text-bbl-muted">Leave the room?</span>
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
      {isHost && snapshot.players.length < 2 && (
        <p className="text-center text-xs text-bbl-muted">
          Invite a friend or add a computer player to start.
        </p>
      )}
      {isHost && !allReady && snapshot.players.length >= 2 && (
        <p className="text-center text-xs text-bbl-muted">Waiting for everyone to be ready…</p>
      )}
    </div>
  );
}
