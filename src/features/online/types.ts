import type {
  BibleQuestion,
  BotDifficulty,
  GameMode,
  GamePhase,
  GameSettings,
  PlayerAvatar,
  PlayerColor,
  PlayerScoreState,
  PublicQuestion,
  TournamentStage,
} from "@/types/game";

export type RoomStatus = "lobby" | "playing" | "complete" | "abandoned";

/** Tournament progress as sent to clients — drives the shrinking-field + duel UI. */
export type TournamentSnapshot = {
  stage: TournamentStage;
  /** the full survivor curve (targets after each field cut), for progress display */
  survivorSchedule: number[];
  /** how many players are still in the running right now */
  survivorCount: number;
  /** target survivors after the current field question resolves; null during the duel */
  nextCutTo: number | null;
  /** playerId → question index at which they were eliminated */
  eliminatedAtIndex: Record<string, number>;
  /** duel sudden-death: outright question wins per finalist */
  duelWins: Record<string, number>;
  championId: string | null;
  /** is the requesting player eliminated (i.e. now a spectator)? */
  meEliminated: boolean;
};

export type SnapshotPlayer = {
  id: string;
  name: string;
  avatar: PlayerAvatar;
  color: PlayerColor;
  isHost: boolean;
  isReady: boolean;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  connected: boolean;
};

/**
 * Game state as sent to clients. During the "question" phase the question is a
 * PublicQuestion (no correct answer / explanation / reference) and other
 * players' selections are hidden — only WHO has answered is exposed.
 */
export type GameSnapshot = {
  phase: GamePhase;
  settings: GameSettings;
  currentIndex: number;
  questionCount: number;
  questionStartedAt: number | null;
  questionDeadline: number | null;
  phaseEndsAt: number | null;
  question: PublicQuestion | BibleQuestion | null;
  /** true when `question` includes the answer/reference/explanation fields */
  revealed: boolean;
  answeredIds: string[];
  myAnswerIndex: number | null;
  scores: Record<string, PlayerScoreState>;
  roundJustEnded: number | null;
  winnerIds: string[] | null;
  /** present only in tournament games */
  tournament: TournamentSnapshot | null;
};

export type RoomSnapshot = {
  roomId: string;
  code: string;
  status: RoomStatus;
  gameMode: GameMode;
  hostPlayerId: string | null;
  maxPlayers: number;
  settings: GameSettings;
  players: SnapshotPlayer[];
  game: GameSnapshot | null;
  serverNow: number;
  version: number;
  myPlayerId: string | null;
};

export type JoinResult = {
  playerId: string;
  token: string;
  code: string;
};

export type ApiError = { error: string; code?: string };
