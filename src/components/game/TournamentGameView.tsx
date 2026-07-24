"use client";

/**
 * Renders an online tournament from server snapshots: the survival field stage,
 * the head-to-head duel final, and the spectator view for eliminated players.
 * All authority lives on the server — this component only displays state and
 * sends answer/advance requests (answers go to the contention-free inbox).
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { RoomSnapshot } from "@/features/online/types";
import { roomActions, type RoomCredentials } from "@/features/online/client";
import type { BibleQuestion, GamePlayer } from "@/types/game";
import { Countdown } from "./Countdown";
import { QuestionHeader } from "./QuestionHeader";
import { AnswerButton } from "./AnswerButton";
import { RevealPanel } from "./RevealPanel";
import { TournamentStandings } from "./TournamentStandings";
import { DuelPanel } from "./DuelPanel";
import { ChampionResult } from "@/components/results/ChampionResult";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/shared/Button";
import { audio } from "@/features/audio/audio";

export function TournamentGameView({
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
  const offsetRef = useRef(0);
  useEffect(() => {
    offsetRef.current = snapshot.serverNow - Date.now();
  }, [snapshot.serverNow]);
  const toLocal = (serverTs: number | null) => (serverTs === null ? null : serverTs - offsetRef.current);

  const [pendingAnswer, setPendingAnswer] = useState<number | null>(null);
  const lastPhase = useRef<string | null>(null);
  const wasEliminated = useRef(false);

  const t = game?.tournament ?? null;

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
    // a gentle cue the moment you're knocked out
    if (t?.meEliminated && !wasEliminated.current) {
      wasEliminated.current = true;
      audio.play("incorrect");
    }
  }, [game, t]);

  if (!game || !t) return null;

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
  const meEliminated = t.meEliminated;
  const survivors = players.filter((p) => t.eliminatedAtIndex[p.id] === undefined);

  if (game.phase === "countdown") {
    return <Countdown endsAt={toLocal(game.phaseEndsAt)} players={survivors} />;
  }

  if (game.phase === "complete") {
    return (
      <ChampionResult
        players={players}
        scores={game.scores}
        tournament={t}
        onHome={onLeft}
        onRematch={isHost ? () => void roomActions.rematch(snapshot.code, creds).then(refresh) : undefined}
        extraActions={
          isHost ? (
            <Button variant="ghost" onClick={() => void roomActions.lobby(snapshot.code, creds).then(refresh)}>
              🏛️ Return to lobby
            </Button>
          ) : undefined
        }
      />
    );
  }

  const question = game.question;
  if (!question) return null;

  const isDuel = t.stage === "duel";
  const revealed = game.phase === "reveal" && game.revealed;

  // ── the answer area (shared by field + duel) ──
  const answeredIds = new Set(game.answeredIds);
  const myAnswer = game.myAnswerIndex ?? pendingAnswer;
  const iAnswered = myAnswer !== null;

  const submit = (index: number) => {
    if (iAnswered || !myId || meEliminated) return;
    setPendingAnswer(index);
    void roomActions
      .answer(snapshot.code, creds, index)
      .then(refresh)
      .catch(() => setPendingAnswer(null));
  };

  const spectatorBanner = meEliminated && (
    <Card className="border-bbl-incorrect/40 bg-bbl-incorrect/10 p-3 text-center text-sm font-semibold text-bbl-incorrect">
      💀 You&apos;ve been eliminated — watching the rest as a spectator.
    </Card>
  );

  const hostContinue = revealed && (
    <div className="text-center">
      {isHost ? (
        <Button variant="gold" onClick={() => void roomActions.advance(snapshot.code, creds).then(refresh)}>
          Continue →
        </Button>
      ) : (
        <p className="text-xs text-bbl-muted">Waiting for the host to continue…</p>
      )}
      <p className="mt-1 text-xs text-bbl-muted">continues automatically</p>
    </div>
  );

  const answerGrid = (
    <div className="grid gap-3 sm:grid-cols-2">
      {question.options.map((opt, i) => (
        <AnswerButton
          key={i}
          index={i}
          text={opt}
          selected={myAnswer === i}
          disabled={iAnswered || meEliminated}
          onSelect={submit}
        />
      ))}
    </div>
  );

  // ── DUEL STAGE ──
  if (isDuel) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <DuelPanel finalists={survivors} tournament={t} myId={myId} />
        {spectatorBanner}
        {revealed ? (
          <>
            <RevealPanel
              question={question as BibleQuestion}
              players={survivors}
              records={Object.fromEntries(survivors.map((p) => [p.id, game.scores[p.id]?.answers[game.currentIndex]]))}
            />
            {hostContinue}
          </>
        ) : (
          <>
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
            {!meEliminated && answerGrid}
            {iAnswered && !meEliminated && (
              <p className="text-center text-sm text-bbl-muted" aria-live="polite">
                Locked in! Waiting for your opponent…
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  // ── FIELD STAGE ──
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      {spectatorBanner}
      {revealed ? (
        <>
          <RevealPanel question={question as BibleQuestion} players={[]} records={{}} />
          {t.nextCutTo !== null && (
            <p className="text-center text-sm font-bold text-bbl-incorrect" aria-live="polite">
              ✂️ Cut to the top {t.nextCutTo}
            </p>
          )}
          <Card className="p-4">
            <TournamentStandings
              players={players}
              scores={game.scores}
              tournament={t}
              currentIndex={game.currentIndex}
              highlightEliminated
              myId={myId}
            />
          </Card>
          {hostContinue}
        </>
      ) : (
        <>
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
          {meEliminated ? null : answerGrid}
          {iAnswered && !meEliminated && (
            <p className="text-center text-sm text-bbl-muted" aria-live="polite">
              Answer locked in! Survive to the next round…
            </p>
          )}
          <Card className="p-4">
            <TournamentStandings
              players={players}
              scores={game.scores}
              tournament={t}
              currentIndex={game.currentIndex}
              answeredIds={answeredIds}
              myId={myId}
            />
          </Card>
        </>
      )}
    </div>
  );
}
