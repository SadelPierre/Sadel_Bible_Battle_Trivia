import { CATEGORY_LABELS, type BibleQuestion } from "@/types/game";
import { TimerRing } from "./TimerRing";

/** Question number, category, difficulty + the timer. */
export function QuestionHeader({
  question,
  index,
  total,
  deadline,
  timerSeconds,
}: {
  question: BibleQuestion;
  index: number;
  total: number;
  deadline: number | null;
  timerSeconds: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-bold text-bbl-muted">
          Question {index + 1} <span className="opacity-60">/ {total}</span>
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-bbl-primary-soft/60 px-2.5 py-0.5 text-xs font-semibold">
            {CATEGORY_LABELS[question.category]}
          </span>
          <span className="rounded-full bg-bbl-gold/15 px-2.5 py-0.5 text-xs font-semibold capitalize text-bbl-gold">
            {question.difficulty}
          </span>
        </div>
        <div
          className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-bbl-primary-soft/40 sm:w-48"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Round progress"
        >
          <div
            className="h-full rounded-full bg-bbl-primary transition-all duration-500"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>
      <TimerRing deadline={deadline} totalMs={timerSeconds * 1000} />
    </div>
  );
}
