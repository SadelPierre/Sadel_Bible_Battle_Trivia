"use client";

/**
 * Renders an online match from server snapshots. All game logic lives on the
 * server; this component displays state and sends answer/advance requests.
 * Server timestamps are converted to local clock time with a measured offset.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { RoomSnapshot } from "@/features/online/types";
import { roomActions, type RoomCredentials } from "@/features/online/client";
import type { BibleQuestion, GamePlayer } from "@/types/game";
import { Countdown } from "./Countdown";
import { QuestionHeader } from "./QuestionHeader";
import { AnswerButton } from "./AnswerButton";
import { Scoreboard } from "./Scoreboard";
import { RevealPanel } from "./RevealPanel";
import { RoundSummary } from "./RoundSummary";
import { FinalResults } from "@/components/results/FinalResults";
import { Button } from "@/components/shared/Button";
import { audio } from "@/features/audio/audio";

export function OnlineGameView({
  snapshot,
  creds,
  refresh,
  onLeft,
}: {
  snapshot: RoomSnapshot;
  creds: RoomCredentials;
  refresh: () => Promise<void>;
  onLeft: () => void;
}) {
  const game = snapshot.game;
  // clock offset: serverNow was measured when this snapshot arrived
  const offsetRef = useRef(0);
  useEffect(() => {
    offsetRef.current = snapshot.serverNow - Date.now();
  }, [snapshot.serverNow]);
  const toLocal = (serverTs: number | null) =>
    serverTs === null ? null : serverTs - offsetRef.current;

  const [pendingAnswer, setPendingAnswer] = useState<number | null>(null);
  const lastPhase = useRef<string | null>(null);

  // phase-change sound cues + clear optimistic answer between questions
  useEffect(() => {
    if (!game) return;
    const key = `${game.phase}:${game.currentIndex}`;
    if (lastPhase.current !== key) {
      if (game.phase === "reveal") audio.play("roundComplete");
      if (game.phase === "complete") audio.play("winner");
      if (game.phase === "question") setPendingAnswer(null);
      lastPhase.current = key;
    }
  }, [game]);

  if (!game) return null;

  const players: GamePlayer[] = snapshot.players.map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    color: p.color,
    isBot: p.isBot,
    botDifficulty: p.botDifficulty,
    connected: p.connected,
  }));
  const isHost = snapshot.hostPlayerId === snapshot.myPlayerId;
  const myId = snapshot.myPlayerId;

  if (game.phase === "countdown") {
    return <Countdown endsAt={toLocal(game.phaseEndsAt)} players={players} />;
  }

  if (game.phase === "complete") {
    return (
      <FinalResults
        players={players}
        scores={game.scores}
        total={game.questionCount}
        onPlayAgain={isHost ? () => void roomActions.rematch(snapshot.code, creds).then(refresh) : undefined}
        playAgainLabel="🔄 Rematch"
        extraActions={
          isHost ? (
            <Button
              variant="ghost"
              onClick={() => void roomActions.lobby(snapshot.code, creds).then(refresh)}
            >
              🏛️ Return to lobby
            </Button>
          ) : (
            <span className="self-center text-sm text-bbl-muted">
              Waiting for the host to start a rematch…
            </span>
          )
        }
        onHome={onLeft}
      />
    );
  }

  if (game.phase === "round-summary") {
    return (
      <div className="space-y-4">
        <RoundSummary
          players={players}
          scores={game.scores}
          answeredCount={game.currentIndex + 1}
          total={game.questionCount}
          roundNumber={game.roundJustEnded}
        />
        {isHost && (
          <div className="text-center">
            <Button
              variant="gold"
              onClick={() => void roomActions.advance(snapshot.code, creds).then(refresh)}
            >
              Continue →
            </Button>
          </div>
        )}
      </div>
    );
  }

  const question = game.question;
  if (!question) return null;

  if (game.phase === "reveal" && game.revealed) {
    const full = question as BibleQuestion;
    const records = Object.fromEntries(
      players.map((p) => [p.id, game.scores[p.id]?.answers[game.currentIndex]]),
    );
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <RevealPanel question={full} players={players} records={records} />
        <Scoreboard players={players} scores={game.scores} compact />
        <div className="text-center">
          {isHost ? (
            <Button
              variant="gold"
              onClick={() => void roomActions.advance(snapshot.code, creds).then(refresh)}
            >
              Continue →
            </Button>
          ) : (
            <p className="text-xs text-bbl-muted">The host can continue early…</p>
          )}
          <p className="mt-1 text-xs text-bbl-muted">continues automatically</p>
        </div>
      </div>
    );
  }

  // ── live question ──
  const answeredIds = new Set(game.answeredIds);
  const myAnswer = game.myAnswerIndex ?? pendingAnswer;
  const iAnswered = myAnswer !== null;

  const submit = (index: number) => {
    if (iAnswered || !myId) return;
    setPendingAnswer(index); // optimistic lock so double-taps can't fire twice
    void roomActions.answer(snapshot.code, creds, index).then(refresh).catch(() => {
      setPendingAnswer(null);
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <QuestionHeader
        question={question as BibleQuestion}
        index={game.currentIndex}
        total={game.questionCount}
        deadline={toLocal(game.questionDeadline)}
        timerSeconds={game.settings.timerSeconds}
      />
      <motion.h2
        key={question.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-balance text-xl font-bold leading-snug sm:text-2xl"
      >
        {question.question}
      </motion.h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {question.options.map((opt, i) => (
          <AnswerButton
            key={i}
            index={i}
            text={opt}
            selected={myAnswer === i}
            disabled={iAnswered}
            onSelect={submit}
          />
        ))}
      </div>
      {iAnswered && (
        <p className="text-center text-sm text-bbl-muted" aria-live="polite">
          Answer locked in! Waiting for the others…
        </p>
      )}
      <Scoreboard players={players} scores={game.scores} answeredIds={answeredIds} compact />
    </div>
  );
}
