"use client";

import { motion } from "framer-motion";
import type { AnswerRecord, BibleQuestion, GamePlayer } from "@/types/game";
import { Card } from "@/components/shared/Card";
import { PlayerChip } from "@/components/shared/PlayerChip";

/**
 * Answer reveal: correct answer, Bible reference, explanation, optional
 * excerpt, and each player's respectful result indicator.
 */
export function RevealPanel({
  question,
  players,
  records,
}: {
  question: BibleQuestion;
  players: GamePlayer[];
  records: Record<string, AnswerRecord | null | undefined>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      aria-live="polite"
    >
      <Card className="p-5 sm:p-6">
        <p className="text-sm font-bold uppercase tracking-wider text-bbl-correct">
          ✓ Correct answer
        </p>
        <p className="mt-1 text-xl font-bold sm:text-2xl">
          {question.options[question.correctAnswerIndex]}
        </p>

        <p className="mt-4 inline-block rounded-lg bg-bbl-gold/15 px-3 py-1 text-sm font-bold text-bbl-gold">
          📖 {question.bibleReference}
        </p>
        <p className="mt-3 text-bbl-text/90">{question.explanation}</p>
        {question.scriptureExcerpt && (
          <blockquote className="mt-3 border-l-4 border-bbl-gold/50 pl-3 text-sm italic text-bbl-muted">
            “{question.scriptureExcerpt}”
            {question.sourceTranslation && (
              <span className="not-italic"> — {question.sourceTranslation}</span>
            )}
          </blockquote>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {players.map((p) => {
            const rec = records[p.id];
            const status = !rec || rec.answerIndex === null ? "none" : rec.isCorrect ? "yes" : "no";
            return (
              <PlayerChip
                key={p.id}
                player={p}
                suffix={
                  <span className="text-xs font-bold">
                    {status === "yes" && (
                      <span className="text-bbl-correct">
                        ✓ +{rec?.totalPoints}
                        {rec && rec.speedBonus > 0 && (
                          <span className="ml-1 text-bbl-gold" title="speed bonus">⚡</span>
                        )}
                        {rec && rec.streakBonus > 0 && (
                          <span className="ml-0.5 text-bbl-gold" title="streak bonus">🔥</span>
                        )}
                      </span>
                    )}
                    {status === "no" && <span className="text-bbl-incorrect">✗ not this time</span>}
                    {status === "none" && <span className="text-bbl-muted">— no answer</span>}
                  </span>
                }
              />
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}
