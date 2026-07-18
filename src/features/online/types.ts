import type {
  BibleQuestion,
  BotDifficulty,
  GamePhase,
  GameSettings,
  PlayerAvatar,
  PlayerColor,
  PlayerScoreState,
  PublicQuestion,
} from "@/types/game";

export type RoomStatus = "lobby" | "playing" | "complete" | "abandoned";

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
};

export type RoomSnapshot = {
  roomId: string;
  code: string;
  status: RoomStatus;
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
