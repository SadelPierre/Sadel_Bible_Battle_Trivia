"use client";

/**
 * Offline game controller for Solo (vs bots) and Local multiplayer.
 * Wraps the pure engine reducer with real timers and bot scheduling.
 *
 * Pass-and-play note: the engine tracks ONE question deadline, but in
 * pass-and-play each player gets a fresh timer when the device is handed over.
 * We keep the engine's invariants by submitting answers with an adjusted `now`
 * equal to questionStartedAt + elapsed-in-this-turn (always <= the deadline).
 */
import { create } from "zustand";
import type { BibleQuestion, GamePlayer, GameSettings, GameState } from "@/types/game";
import {
  COUNTDOWN_MS,
  createGame,
  currentQuestion,
  gameReducer,
  shouldReveal,
} from "@/features/game-engine/engine";
import { planBotAnswer } from "@/features/computer-players/bots";
import { selectQuestions } from "@/features/questions/select";
import { QUESTION_BANK } from "@/features/questions/bank";
import { audio } from "@/features/audio/audio";

export type LocalStyle = "shared" | "pass";

export type OfflineConfig = {
  mode: "solo" | "local";
  localStyle: LocalStyle;
  settings: GameSettings;
  players: GamePlayer[];
};

type PassTurn = {
  playerIndex: number; // index into humanPlayers order for the current question
  confirmed: boolean; // has this player confirmed the hand-off?
  turnStartedAt: number | null;
};

type OfflineGameStore = {
  config: OfflineConfig | null;
  game: GameState | null;
  /** ids of questions used in the previous match (rematch avoids repeats) */
  usedQuestionIds: string[];
  passTurn: PassTurn | null;
  start: (config: OfflineConfig) => void;
  rematch: () => void;
  submitAnswer: (playerId: string, answerIndex: number) => void;
  confirmPassTurn: () => void;
  advance: () => void; // manual "Continue" from reveal / summary
  quit: () => void;
};

let tickInterval: ReturnType<typeof setInterval> | null = null;
let botTimeouts: ReturnType<typeof setTimeout>[] = [];

function clearTimers() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = null;
  for (const t of botTimeouts) clearTimeout(t);
  botTimeouts = [];
}

function humanPlayers(config: OfflineConfig): GamePlayer[] {
  return config.players.filter((p) => !p.isBot);
}

export const useOfflineGame = create<OfflineGameStore>((set, get) => {
  /** dispatch + react to phase changes (bot scheduling, sounds, pass turns) */
  function apply(actionFn: (state: GameState) => GameState) {
    const { game } = get();
    if (!game) return;
    const next = actionFn(game);
    if (next === game) return;
    const phaseChanged = next.phase !== game.phase || next.currentIndex !== game.currentIndex;
    set({ game: next });
    if (phaseChanged) onPhaseEnter(next, game);
  }

  function onPhaseEnter(state: GameState, prev: GameState) {
    const { config } = get();
    if (!config) return;
    if (state.phase === "question") {
      scheduleBots(state);
      if (config.mode === "local" && config.localStyle === "pass") {
        set({ passTurn: { playerIndex: 0, confirmed: false, turnStartedAt: null } });
      }
    }
    if (state.phase === "reveal" && prev.phase === "question") {
      audio.play("roundComplete");
    }
    if (state.phase === "complete") {
      clearTimers();
      audio.play("winner");
      set({ usedQuestionIds: state.questions.map((q: BibleQuestion) => q.id) });
    }
  }

  function scheduleBots(state: GameState) {
    const question = currentQuestion(state);
    const timerMs = state.settings.timerSeconds * 1000;
    for (const player of state.players) {
      if (!player.isBot) continue;
      const plan = planBotAnswer(player.botDifficulty ?? "medium", question, timerMs);
      const timeout = setTimeout(() => {
        apply((s) =>
          gameReducer(s, {
            type: "SUBMIT_ANSWER",
            playerId: player.id,
            answerIndex: plan.answerIndex,
            now: Date.now(),
          }),
        );
      }, plan.delayMs);
      botTimeouts.push(timeout);
    }
  }

  function tick() {
    const { game, config, passTurn } = get();
    if (!game || !config) return;
    const now = Date.now();

    if (game.phase === "countdown" && game.phaseEndsAt !== null && now >= game.phaseEndsAt) {
      audio.play("countdownGo");
      apply((s) => gameReducer(s, { type: "COUNTDOWN_FINISHED", now }));
      return;
    }

    if (game.phase === "question") {
      const isPass = config.mode === "local" && config.localStyle === "pass";
      if (isPass && passTurn) {
        // per-turn timeout: move to the next player when this player's time is up
        if (passTurn.confirmed && passTurn.turnStartedAt !== null) {
          const elapsed = now - passTurn.turnStartedAt;
          if (elapsed >= game.settings.timerSeconds * 1000) nextPassTurn();
        }
        // bots have answered via schedule; reveal happens when all turns are done
        return;
      }
      if (shouldReveal(game, now)) {
        apply((s) => gameReducer(s, { type: "LOCK_AND_REVEAL", now }));
      }
      return;
    }

    if (
      (game.phase === "reveal" || game.phase === "round-summary") &&
      game.phaseEndsAt !== null &&
      now >= game.phaseEndsAt
    ) {
      apply((s) => gameReducer(s, { type: "ADVANCE", now }));
    }
  }

  function nextPassTurn() {
    const { config, game, passTurn } = get();
    if (!config || !game || !passTurn) return;
    const humans = humanPlayers(config);
    const nextIndex = passTurn.playerIndex + 1;
    if (nextIndex >= humans.length) {
      set({ passTurn: null });
      apply((s) => gameReducer(s, { type: "LOCK_AND_REVEAL", now: Date.now() }));
    } else {
      set({ passTurn: { playerIndex: nextIndex, confirmed: false, turnStartedAt: null } });
    }
  }

  function beginMatch(config: OfflineConfig, excludeIds: Set<string>) {
    clearTimers();
    const questions = selectQuestions(QUESTION_BANK, config.settings, excludeIds);
    const game = createGame(config.settings, config.players, questions, Date.now());
    set({ config, game, passTurn: null });
    audio.play("gameStart");
    tickInterval = setInterval(tick, 200);
  }

  return {
    config: null,
    game: null,
    usedQuestionIds: [],
    passTurn: null,

    start: (config) => beginMatch(config, new Set(get().usedQuestionIds)),

    rematch: () => {
      const { config, usedQuestionIds } = get();
      if (!config) return;
      beginMatch(config, new Set(usedQuestionIds));
    },

    submitAnswer: (playerId, answerIndex) => {
      const { game, config, passTurn } = get();
      if (!game || game.phase !== "question") return;
      const isPass = config?.mode === "local" && config.localStyle === "pass";
      if (isPass && passTurn) {
        const humans = humanPlayers(config);
        const turnPlayer = humans[passTurn.playerIndex];
        if (!turnPlayer || turnPlayer.id !== playerId) return;
        if (!passTurn.confirmed || passTurn.turnStartedAt === null) return;
        const elapsed = Date.now() - passTurn.turnStartedAt;
        const adjustedNow = (game.questionStartedAt ?? Date.now()) + elapsed;
        apply((s) =>
          gameReducer(s, { type: "SUBMIT_ANSWER", playerId, answerIndex, now: adjustedNow }),
        );
        nextPassTurn();
        return;
      }
      apply((s) =>
        gameReducer(s, { type: "SUBMIT_ANSWER", playerId, answerIndex, now: Date.now() }),
      );
    },

    confirmPassTurn: () => {
      const { passTurn } = get();
      if (!passTurn || passTurn.confirmed) return;
      set({ passTurn: { ...passTurn, confirmed: true, turnStartedAt: Date.now() } });
    },

    advance: () => {
      const { game } = get();
      if (!game) return;
      if (game.phase === "reveal" || game.phase === "round-summary") {
        apply((s) => gameReducer(s, { type: "ADVANCE", now: Date.now() }));
      }
    },

    quit: () => {
      clearTimers();
      set({ game: null, config: null, passTurn: null });
    },
  };
});

export { COUNTDOWN_MS };
