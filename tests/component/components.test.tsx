import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnswerButton } from "@/components/game/AnswerButton";
import { Scoreboard } from "@/components/game/Scoreboard";
import { RevealPanel } from "@/components/game/RevealPanel";
import { QuestionHeader } from "@/components/game/QuestionHeader";
import { FinalResults } from "@/components/results/FinalResults";
import type { AnswerRecord, BibleQuestion, GamePlayer, PlayerScoreState } from "@/types/game";

const question: BibleQuestion = {
  id: "t1",
  question: "Who built the ark before the great flood?",
  options: ["Noah", "Moses", "Abraham", "David"],
  correctAnswerIndex: 0,
  bibleReference: "Genesis 6:13-22",
  explanation: "God told Noah to build an ark and he obeyed in faith.",
  scriptureExcerpt: "Make thee an ark of gopher wood.",
  sourceTranslation: "KJV",
  category: "old-testament",
  difficulty: "easy",
  testament: "old",
  tags: [],
  isReviewed: true,
};

const players: GamePlayer[] = [
  { id: "p1", name: "Grace", color: "royal", avatar: "dove", isBot: false, connected: true },
  { id: "p2", name: "Levi", color: "amber", avatar: "star", isBot: false, connected: true },
];

const score = (over: Partial<PlayerScoreState> = {}): PlayerScoreState => ({
  score: 0,
  correctCount: 0,
  streak: 0,
  bestStreak: 0,
  correctResponseMsTotal: 0,
  answers: [],
  ...over,
});

describe("AnswerButton", () => {
  it("renders the option text and fires onSelect", () => {
    const onSelect = vi.fn();
    render(
      <AnswerButton index={0} text="Noah" selected={false} disabled={false} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Answer A: Noah/i }));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it("cannot be clicked when disabled and announces reveal state", () => {
    const onSelect = vi.fn();
    render(
      <AnswerButton
        index={1}
        text="Moses"
        selected={false}
        disabled={true}
        reveal="correct"
        onSelect={onSelect}
      />,
    );
    const btn = screen.getByRole("button", { name: /correct answer/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("Scoreboard", () => {
  it("shows players ranked with scores and answer status", () => {
    render(
      <Scoreboard
        players={players}
        scores={{ p1: score({ score: 250 }), p2: score({ score: 100 }) }}
        answeredIds={new Set(["p1"])}
      />,
    );
    expect(screen.getByText("Grace")).toBeInTheDocument();
    expect(screen.getByText("Levi")).toBeInTheDocument();
    expect(screen.getByLabelText("answered")).toBeInTheDocument();
    expect(screen.getByLabelText("thinking")).toBeInTheDocument();
  });
});

describe("RevealPanel", () => {
  it("shows the correct answer, reference, explanation, and player results", () => {
    const correct: AnswerRecord = {
      answerIndex: 0,
      responseMs: 3000,
      isCorrect: true,
      basePoints: 100,
      speedBonus: 20,
      streakBonus: 0,
      totalPoints: 120,
    };
    render(
      <RevealPanel
        question={question}
        players={players}
        records={{ p1: correct, p2: null }}
      />,
    );
    expect(screen.getByText("Noah")).toBeInTheDocument();
    expect(screen.getByText(/Genesis 6:13-22/)).toBeInTheDocument();
    expect(screen.getByText(/obeyed in faith/)).toBeInTheDocument();
    expect(screen.getByText(/\+120/)).toBeInTheDocument();
    expect(screen.getByText(/no answer/)).toBeInTheDocument();
  });
});

describe("QuestionHeader", () => {
  it("shows question number, category, difficulty, and a timer", () => {
    render(
      <QuestionHeader question={question} index={2} total={10} deadline={null} timerSeconds={15} />,
    );
    expect(screen.getByText(/Question 3/)).toBeInTheDocument();
    expect(screen.getByText("Old Testament")).toBeInTheDocument();
    expect(screen.getByText("easy")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toBeInTheDocument();
  });
});

describe("FinalResults", () => {
  it("announces the winner and shows the leaderboard", () => {
    render(
      <FinalResults
        players={players}
        scores={{
          p1: score({ score: 500, correctCount: 5, bestStreak: 3 }),
          p2: score({ score: 300, correctCount: 3, bestStreak: 2 }),
        }}
        total={10}
        onHome={() => {}}
      />,
    );
    expect(screen.getByText(/Grace wins!/)).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("announces ties", () => {
    render(
      <FinalResults
        players={players}
        scores={{ p1: score({ score: 300 }), p2: score({ score: 300 }) }}
        total={10}
        onHome={() => {}}
      />,
    );
    expect(screen.getByText(/It's a tie/)).toBeInTheDocument();
  });
});
