"use client";

/**
 * Full game flow renderer for Solo and Local (shared-screen / pass-and-play).
 * Phases: countdown → question → reveal → round-summary → complete.
 */
import { useEffect } from "react";
import { motion } from "framer-motion";
import { useOfflineGame } from "@/stores/offlineGame";
import { currentQuestion } from "@/features/game-engine/engine";
import { AVATAR_EMOJI } from "@/types/game";
import { PLAYER_COLOR_STYLES } from "@/lib/playerColors";
import { Countdown } from "./Countdown";
import { QuestionHeader } from "./QuestionHeader";
import { AnswerButton } from "./AnswerButton";
import { Scoreboard } from "./Scoreboard";
import { RevealPanel } from "./RevealPanel";
import { RoundSummary } from "./RoundSummary";
import { FinalResults } from "@/components/results/FinalResults";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { audio } from "@/features/audio/audio";

/** keyboard rows for shared-screen mode: player N → 4 answer keys */
const SHARED_KEYS = [
  ["1", "2", "3", "4"],
  ["q", "w", "e", "r"],
  ["a", "s", "d", "f"],
  ["z", "x", "c", "v"],
];

export function OfflineGameView({ onExit }: { onExit: () => void }) {
  const store = useOfflineGame();
  const { game, config, passTurn } = store;

  // keyboard shortcuts for shared-screen local mode
  useEffect(() => {
    if (!game || !config) return;
    if (!(config.mode === "local" && config.localStyle === "shared")) return;
    const humans = config.players.filter((p) => !p.isBot);
    const handler = (e: KeyboardEvent) => {
      if (game.phase !== "question") return;
      humans.forEach((p, pi) => {
        const keyIndex = SHARED_KEYS[pi]?.indexOf(e.key.toLowerCase()) ?? -1;
        if (keyIndex >= 0) store.submitAnswer(p.id, keyIndex);
      });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [game, config, store]);

  if (!game || !config) return null;

  if (game.phase === "countdown") {
    return <Countdown endsAt={game.phaseEndsAt} players={game.players} />;
  }

  if (game.phase === "complete") {
    return (
      <FinalResults
        players={game.players}
        scores={game.scores}
        total={game.questions.length}
        onPlayAgain={() => store.rematch()}
        playAgainLabel="🔄 Rematch"
        onHome={() => {
          store.quit();
          onExit();
        }}
      />
    );
  }

  if (game.phase === "round-summary") {
    return (
      <div className="space-y-4">
        <RoundSummary
          players={game.players}
          scores={game.scores}
          answeredCount={game.currentIndex + 1}
          total={game.questions.length}
          roundNumber={game.roundJustEnded}
        />
        <div className="text-center">
          <Button variant="gold" onClick={() => store.advance()}>
            Continue →
          </Button>
        </div>
      </div>
    );
  }

  const question = currentQuestion(game);
  const humans = config.players.filter((p) => !p.isBot);
  const isPass = config.mode === "local" && config.localStyle === "pass";
  const isShared = config.mode === "local" && config.localStyle === "shared";

  if (game.phase === "reveal") {
    const records = Object.fromEntries(
      game.players.map((p) => [p.id, game.scores[p.id]?.answers[game.currentIndex]]),
    );
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <RevealPanel question={question} players={game.players} records={records} />
        <Scoreboard players={game.players} scores={game.scores} compact />
        <div className="text-center">
          <Button variant="gold" onClick={() => store.advance()}>
            Continue →
          </Button>
          <p className="mt-1 text-xs text-bbl-muted">continues automatically…</p>
        </div>
      </div>
    );
  }

  // ── phase === "question" ─────────────────────────────────────

  // Pass-and-play: hand-off gate before each player's private turn
  if (isPass && passTurn) {
    const turnPlayer = humans[passTurn.playerIndex];
    if (!turnPlayer) return null;
    const c = PLAYER_COLOR_STYLES[turnPlayer.color];
    if (!passTurn.confirmed) {
      return (
        <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-6">
          <Card className={`w-full border-2 p-8 text-center ${c.border}`}>
            <div className="text-5xl" aria-hidden>
              {AVATAR_EMOJI[turnPlayer.avatar]}
            </div>
            <h2 className="mt-3 text-2xl font-black">
              Pass the device to <span className={c.text}>{turnPlayer.name}</span>
            </h2>
            <p className="mt-2 text-sm text-bbl-muted">
              Question {game.currentIndex + 1} of {game.questions.length}. Your timer starts when
              you press the button — no peeking, everyone else! 🙈
            </p>
            <Button
              variant="gold"
              size="lg"
              className="mt-6"
              onClick={() => {
                audio.play("gameStart");
                store.confirmPassTurn();
              }}
            >
              I&apos;m {turnPlayer.name} — Show my question
            </Button>
          </Card>
        </div>
      );
    }
    const turnDeadline =
      passTurn.turnStartedAt !== null
        ? passTurn.turnStartedAt + game.settings.timerSeconds * 1000
        : null;
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <p className={`text-center text-sm font-bold ${c.text}`}>
          {AVATAR_EMOJI[turnPlayer.avatar]} {turnPlayer.name}&apos;s turn
        </p>
        <QuestionHeader
          question={question}
          index={game.currentIndex}
          total={game.questions.length}
          deadline={turnDeadline}
          timerSeconds={game.settings.timerSeconds}
        />
        <QuestionText text={question.question} />
        <div className="grid gap-3 sm:grid-cols-2">
          {question.options.map((opt, i) => (
            <AnswerButton
              key={i}
              index={i}
              text={opt}
              selected={false}
              disabled={false}
              onSelect={(idx) => store.submitAnswer(turnPlayer.id, idx)}
            />
          ))}
        </div>
      </div>
    );
  }

  // Solo & shared-screen: everyone sees the question simultaneously
  const answeredIds = new Set(Object.keys(game.pendingAnswers));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <QuestionHeader
        question={question}
        index={game.currentIndex}
        total={game.questions.length}
        deadline={game.questionDeadline}
        timerSeconds={game.settings.timerSeconds}
      />
      <QuestionText text={question.question} />

      {config.mode === "solo" && humans[0] && (
        <div className="grid gap-3 sm:grid-cols-2">
          {question.options.map((opt, i) => {
            const mine = game.pendingAnswers[humans[0]!.id];
            return (
              <AnswerButton
                key={i}
                index={i}
                text={opt}
                selected={mine?.answerIndex === i}
                disabled={mine !== undefined}
                onSelect={(idx) => store.submitAnswer(humans[0]!.id, idx)}
              />
            );
          })}
        </div>
      )}

      {isShared && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {question.options.map((opt, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-xl border border-bbl-border bg-bbl-card px-3 py-2 text-sm sm:text-base"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bbl-primary-soft text-xs font-black">
                  {["A", "B", "C", "D"][i]}
                </span>
                {opt}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {humans.map((p, pi) => {
              const c = PLAYER_COLOR_STYLES[p.color];
              const mine = game.pendingAnswers[p.id];
              return (
                <div
                  key={p.id}
                  className={`flex flex-wrap items-center gap-2 rounded-xl border p-2 ${c.bg} ${c.border}`}
                >
                  <span className={`min-w-24 text-sm font-bold ${c.text}`}>
                    {AVATAR_EMOJI[p.avatar]} {p.name}
                    {mine !== undefined && <span className="ml-1">✅</span>}
                  </span>
                  <div className="flex gap-1.5">
                    {["A", "B", "C", "D"].map((letter, i) => (
                      <button
                        key={letter}
                        disabled={mine !== undefined}
                        aria-label={`${p.name} answers ${letter}`}
                        className={`h-11 w-11 rounded-lg border-2 text-sm font-black transition-all active:scale-95 disabled:opacity-40 cursor-pointer ${
                          mine?.answerIndex === i
                            ? "border-bbl-gold bg-bbl-gold/30"
                            : "border-bbl-border bg-bbl-card hover:border-bbl-primary"
                        }`}
                        onClick={() => {
                          audio.unlock();
                          store.submitAnswer(p.id, i);
                        }}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                  <kbd className="ml-auto hidden text-[10px] text-bbl-muted sm:block">
                    keys: {SHARED_KEYS[pi]?.join(" ").toUpperCase()}
                  </kbd>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Scoreboard
        players={game.players}
        scores={game.scores}
        answeredIds={answeredIds}
        compact
      />
    </div>
  );
}

function QuestionText({ text }: { text: string }) {
  return (
    <motion.h2
      key={text}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-balance text-xl font-bold leading-snug sm:text-2xl"
    >
      {text}
    </motion.h2>
  );
}
