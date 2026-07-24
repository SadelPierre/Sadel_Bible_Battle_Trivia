import { describe, expect, it } from "vitest";
import { createTournamentGame, gameReducer, allAnswered } from "@/features/game-engine/engine";
import { buildSurvivorSchedule } from "@/features/tournament/tournament";
import { DEFAULT_SETTINGS, type BibleQuestion, type GamePlayer, type GameState } from "@/types/game";

const q = (id: string, correct = 0): BibleQuestion => ({
  id,
  question: `Test question ${id} about a Bible fact?`,
  options: ["Answer A", "Answer B", "Answer C", "Answer D"],
  correctAnswerIndex: correct,
  bibleReference: "John 3:16",
  explanation: "This is a test explanation for the question.",
  category: "general",
  difficulty: "easy",
  testament: "new",
  tags: [],
  isReviewed: true,
});

const COLORS = ["royal", "crimson", "emerald", "amber", "violet", "teal"] as const;
const AVATARS = ["dove", "lamp", "scroll", "crown", "star", "harp"] as const;

function makePlayers(n: number): GamePlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    color: COLORS[i % COLORS.length]!,
    avatar: AVATARS[i % AVATARS.length]!,
    isBot: false,
    connected: true,
  }));
}

const settings = { ...DEFAULT_SETTINGS, timerSeconds: 15 as const, revealSeconds: 5, roundSize: 0 };
const T0 = 1_000_000;

/** Submit the given answers for one question, then lock+reveal. */
function playQuestion(
  state: GameState,
  answers: Record<string, { i: number; ms: number }>,
): GameState {
  let g = gameReducer(state, { type: "COUNTDOWN_FINISHED", now: T0 });
  const start = g.questionStartedAt!;
  for (const [pid, a] of Object.entries(answers)) {
    g = gameReducer(g, { type: "SUBMIT_ANSWER", playerId: pid, answerIndex: a.i, now: start + a.ms });
  }
  return gameReducer(g, { type: "LOCK_AND_REVEAL", now: g.questionDeadline! });
}

describe("buildSurvivorSchedule", () => {
  it("brings 30 players to a duel via a strictly decreasing curve", () => {
    const s = buildSurvivorSchedule(30);
    expect(s[0]).toBeLessThan(30);
    expect(s[s.length - 1]).toBe(2);
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeLessThan(s[i - 1]!);
    expect(s).toEqual([18, 11, 7, 5, 3, 2]);
  });

  it("handles tiny and edge fields", () => {
    expect(buildSurvivorSchedule(2)).toEqual([]); // already a duel
    expect(buildSurvivorSchedule(3)).toEqual([2]);
    expect(buildSurvivorSchedule(4)).toEqual([3, 2]);
  });

  it("always converges to exactly 2 for every field size up to 30", () => {
    for (let n = 3; n <= 30; n++) {
      const s = buildSurvivorSchedule(n);
      expect(s[s.length - 1]).toBe(2);
      let prev = n;
      for (const target of s) {
        expect(target).toBeLessThan(prev);
        prev = target;
      }
    }
  });
});

describe("survival elimination", () => {
  // 6 players → schedule [4, 3, 2]: three cuts then a duel.
  const players = makePlayers(6);
  const questions = [q("q1"), q("q2"), q("q3"), q("q4"), q("q5"), q("q6")];

  // Everyone answers correctly; faster response = higher speed bonus = safer.
  // Ranking best→worst is always p1..p6 by these times.
  const speeds: Record<string, number> = { p1: 1000, p2: 2000, p3: 3000, p4: 4000, p5: 5000, p6: 6000 };
  const answersFor = (alive: string[]): Record<string, { i: number; ms: number }> =>
    Object.fromEntries(alive.map((id) => [id, { i: 0, ms: speeds[id]! }]));

  it("starts in the field stage with a schedule", () => {
    const g = createTournamentGame(settings, players, questions, T0);
    expect(g.phase).toBe("countdown");
    expect(g.tournament?.stage).toBe("field");
    expect(g.tournament?.survivorSchedule).toEqual([4, 3, 2]);
  });

  it("cuts the field each round, converges to a duel, and crowns a champion", () => {
    let g: GameState = createTournamentGame(settings, players, questions, T0);

    // Q0 → cut to 4: the two slowest (p5, p6) are out.
    g = playQuestion(g, answersFor(["p1", "p2", "p3", "p4", "p5", "p6"]));
    expect(g.tournament?.eliminatedAtIndex).toEqual({ p5: 0, p6: 0 });
    expect(g.tournament?.stage).toBe("field");
    g = gameReducer(g, { type: "ADVANCE", now: g.phaseEndsAt! });
    expect(g.phase).toBe("question");
    expect(g.currentIndex).toBe(1);

    // Q1 → cut to 3: p4 out.
    g = playQuestion(g, answersFor(["p1", "p2", "p3", "p4"]));
    expect(g.tournament?.eliminatedAtIndex.p4).toBe(1);
    g = gameReducer(g, { type: "ADVANCE", now: g.phaseEndsAt! });

    // Q2 → cut to 2: p3 out, stage flips to the duel.
    g = playQuestion(g, answersFor(["p1", "p2", "p3"]));
    expect(g.tournament?.eliminatedAtIndex.p3).toBe(2);
    expect(g.tournament?.stage).toBe("duel");
    g = gameReducer(g, { type: "ADVANCE", now: g.phaseEndsAt! });

    // Q3 duel: p1 faster → wins point 1.
    g = playQuestion(g, answersFor(["p1", "p2"]));
    expect(g.tournament?.duelWins.p1).toBe(1);
    expect(g.tournament?.championId).toBeNull();
    g = gameReducer(g, { type: "ADVANCE", now: g.phaseEndsAt! });

    // Q4 duel: p1 wins point 2 → champion.
    g = playQuestion(g, answersFor(["p1", "p2"]));
    expect(g.tournament?.duelWins.p1).toBe(2);
    expect(g.tournament?.championId).toBe("p1");
    g = gameReducer(g, { type: "ADVANCE", now: g.phaseEndsAt! });
    expect(g.phase).toBe("complete");
    expect(g.winnerIds).toEqual(["p1"]);
  });

  it("locks eliminated players out of answering and does not wait for them", () => {
    let g: GameState = createTournamentGame(settings, players, questions, T0);
    g = playQuestion(g, answersFor(["p1", "p2", "p3", "p4", "p5", "p6"]));
    g = gameReducer(g, { type: "ADVANCE", now: g.phaseEndsAt! });
    // p6 was eliminated at Q0; their answer must be rejected as a spectator.
    const start = g.questionStartedAt!;
    const rejected = gameReducer(g, { type: "SUBMIT_ANSWER", playerId: "p6", answerIndex: 0, now: start + 500 });
    expect(rejected).toBe(g);
    // allAnswered must ignore the eliminated pair once the survivors have answered.
    for (const id of ["p1", "p2", "p3", "p4"]) {
      g = gameReducer(g, { type: "SUBMIT_ANSWER", playerId: id, answerIndex: 0, now: start + 1000 });
    }
    expect(allAnswered(g)).toBe(true);
  });
});

describe("full-field convergence", () => {
  // Drive a real N-player tournament to completion: every survivor answers
  // correctly, with a fixed per-player speed so p1 is always fastest. Proves the
  // whole field collapses to exactly one champion.
  const idIndex = (id: string) => Number(id.slice(1));
  const speedOf = (id: string) => 100 + idIndex(id) * 10; // 110ms … 400ms, all < timer

  function playToEnd(start: GameState): GameState {
    let g = start;
    let guard = 0;
    while (g.phase !== "complete" && guard++ < 200) {
      g = gameReducer(g, { type: "COUNTDOWN_FINISHED", now: T0 }); // no-op after the first question
      const qStart = g.questionStartedAt!;
      for (const p of g.players) {
        if (g.tournament!.eliminatedAtIndex[p.id] !== undefined) continue; // spectators can't answer
        g = gameReducer(g, { type: "SUBMIT_ANSWER", playerId: p.id, answerIndex: 0, now: qStart + speedOf(p.id) });
      }
      g = gameReducer(g, { type: "LOCK_AND_REVEAL", now: g.questionDeadline! });
      g = gameReducer(g, { type: "ADVANCE", now: g.phaseEndsAt ?? qStart + 30_000 });
    }
    return g;
  }

  it("collapses a 30-player field to a single champion", () => {
    const players = makePlayers(30);
    const questions = Array.from({ length: 15 }, (_, i) => q(`q${i + 1}`));
    const g = playToEnd(createTournamentGame(settings, players, questions, T0));

    expect(g.phase).toBe("complete");
    expect(g.winnerIds).toHaveLength(1);
    expect(g.winnerIds).toEqual(["p1"]); // fastest-correct every round
    expect(g.tournament?.championId).toBe("p1");
    // 28 players eliminated in the field; the runner-up (p2) is beaten in the duel, not "eliminated"
    expect(Object.keys(g.tournament!.eliminatedAtIndex)).toHaveLength(28);
    expect(g.tournament?.eliminatedAtIndex.p2).toBeUndefined();
  });

  it("crowns exactly one champion for every field size from 3 to 30", () => {
    for (let n = 3; n <= 30; n++) {
      const players = makePlayers(n);
      const questions = Array.from({ length: 20 }, (_, i) => q(`q${i + 1}`));
      const g = playToEnd(createTournamentGame(settings, players, questions, T0));
      expect(g.phase, `field of ${n} should complete`).toBe("complete");
      expect(g.winnerIds, `field of ${n} should have one winner`).toHaveLength(1);
      expect(g.winnerIds, `field of ${n} champion`).toEqual(["p1"]);
    }
  });
});

describe("duel grace", () => {
  it("awards no point when both finalists miss, then resolves on decisive questions", () => {
    const players = makePlayers(2); // starts directly in the duel stage
    const questions = [q("q1", 0), q("q2", 0), q("q3", 0)];
    let g: GameState = createTournamentGame(settings, players, questions, T0);
    expect(g.tournament?.stage).toBe("duel");

    // Q0: both answer wrong (index 1, correct is 0) → no winner, duel continues.
    g = playQuestion(g, { p1: { i: 1, ms: 1000 }, p2: { i: 1, ms: 1200 } });
    expect(g.tournament?.duelWins).toEqual({});
    expect(g.tournament?.championId).toBeNull();
    g = gameReducer(g, { type: "ADVANCE", now: g.phaseEndsAt! });

    // Q1: only p2 correct → p2 point.
    g = playQuestion(g, { p1: { i: 1, ms: 1000 }, p2: { i: 0, ms: 1200 } });
    expect(g.tournament?.duelWins.p2).toBe(1);
    g = gameReducer(g, { type: "ADVANCE", now: g.phaseEndsAt! });

    // Q2: p2 correct again → champion.
    g = playQuestion(g, { p1: { i: 1, ms: 1000 }, p2: { i: 0, ms: 1200 } });
    expect(g.tournament?.championId).toBe("p2");
    g = gameReducer(g, { type: "ADVANCE", now: g.phaseEndsAt! });
    expect(g.phase).toBe("complete");
    expect(g.winnerIds).toEqual(["p2"]);
  });
});
