import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AnswerButton } from "@/components/game/AnswerButton";
import { Scoreboard } from "@/components/game/Scoreboard";
import { RevealPanel } from "@/components/game/RevealPanel";
import { QuestionHeader } from "@/components/game/QuestionHeader";
import { FinalResults } from "@/components/results/FinalResults";
import { TournamentGameView } from "@/components/game/TournamentGameView";
import { DEFAULT_SETTINGS } from "@/types/game";
import type { AnswerRecord, BibleQuestion, GamePlayer, PlayerScoreState } from "@/types/game";
import type { RoomSnapshot } from "@/features/online/types";
import type { RoomCredentials } from "@/features/online/client";

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

describe("TournamentGameView spectator controls", () => {
  const creds: RoomCredentials = { playerId: "p1", token: "tok" };

  /** A live field question with the requesting player already knocked out. */
  const eliminatedSnapshot = (over: Partial<RoomSnapshot> = {}): RoomSnapshot => ({
    roomId: "r1",
    code: "ABCDE",
    status: "playing",
    gameMode: "tournament",
    hostPlayerId: "p2",
    maxPlayers: 30,
    settings: DEFAULT_SETTINGS,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      isHost: p.id === "p2",
      isReady: true,
      isBot: false,
      connected: true,
    })),
    game: {
      phase: "question",
      settings: DEFAULT_SETTINGS,
      currentIndex: 1,
      questionCount: 10,
      questionStartedAt: 0,
      questionDeadline: null,
      phaseEndsAt: null,
      question,
      revealed: false,
      answeredIds: [],
      myAnswerIndex: null,
      scores: { p1: score(), p2: score() },
      roundJustEnded: null,
      winnerIds: null,
      tournament: {
        stage: "field",
        survivorSchedule: [1],
        survivorCount: 1,
        nextCutTo: null,
        eliminatedAtIndex: { p1: 0 },
        duelWins: {},
        championId: null,
        meEliminated: true,
      },
    },
    serverNow: 0,
    version: 1,
    myPlayerId: "p1",
    ...over,
  });

  it("keeps spectating by default and never leaves without confirmation", () => {
    const onLeaveMidGame = vi.fn(async () => {});
    render(
      <TournamentGameView
        snapshot={eliminatedSnapshot()}
        creds={creds}
        refresh={async () => {}}
        onLeft={vi.fn()}
        onLeaveMidGame={onLeaveMidGame}
      />,
    );
    // still watching: the live question is on screen, no answer buttons
    expect(screen.getByText(question.question)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Answer A/i })).not.toBeInTheDocument();

    // one click arms the confirm, it must not leave outright
    fireEvent.click(screen.getByRole("button", { name: /Leave tournament/i }));
    expect(onLeaveMidGame).not.toHaveBeenCalled();
    expect(screen.getByText(/Leave for good\?/)).toBeInTheDocument();
  });

  it("leaves on confirm and backs out on 'Keep watching'", () => {
    const onLeaveMidGame = vi.fn(async () => {});
    render(
      <TournamentGameView
        snapshot={eliminatedSnapshot()}
        creds={creds}
        refresh={async () => {}}
        onLeft={vi.fn()}
        onLeaveMidGame={onLeaveMidGame}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Leave tournament/i }));
    fireEvent.click(screen.getByRole("button", { name: /Keep watching/i }));
    expect(onLeaveMidGame).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Leave tournament/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Leave tournament/i }));
    fireEvent.click(screen.getByRole("button", { name: /Yes, leave/i }));
    expect(onLeaveMidGame).toHaveBeenCalledTimes(1);
  });

  it("keeps the player in the room and offers a retry when leaving fails", async () => {
    // A rejected leave means the seat still exists server-side. The player has
    // to stay put — silently navigating home would lock them out of a room
    // they still occupy.
    const onLeaveMidGame = vi.fn(async () => {
      throw new Error("Network unreachable.");
    });
    render(
      <TournamentGameView
        snapshot={eliminatedSnapshot()}
        creds={creds}
        refresh={async () => {}}
        onLeft={vi.fn()}
        onLeaveMidGame={onLeaveMidGame}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Leave tournament/i }));
    // the failure lands in a rejected promise, so let React flush it
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Yes, leave/i }));
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/still in the room/i);
    expect(alert).toHaveTextContent(/Network unreachable/);

    // and the confirm stays armed so a second press retries
    const retry = screen.getByRole("button", { name: /Yes, leave/i });
    expect(retry).toBeEnabled();
    await act(async () => {
      fireEvent.click(retry);
    });
    expect(onLeaveMidGame).toHaveBeenCalledTimes(2);
  });

  it("offers no leave control while you are still in the running", () => {
    const snap = eliminatedSnapshot();
    snap.game!.tournament!.meEliminated = false;
    snap.game!.tournament!.eliminatedAtIndex = {};
    render(
      <TournamentGameView
        snapshot={snap}
        creds={creds}
        refresh={async () => {}}
        onLeft={vi.fn()}
        onLeaveMidGame={vi.fn(async () => {})}
      />,
    );
    expect(screen.queryByRole("button", { name: /Leave tournament/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Answer A/i })).toBeInTheDocument();
  });
});
