/**
 * Core shared types for Bible Battle Live.
 * These types are used by the solo, local, and online game modes —
 * the game engine is a single pure reducer over this state.
 */

export type BibleCategory =
  | "old-testament"
  | "new-testament"
  | "life-of-jesus"
  | "bible-characters"
  | "bible-books"
  | "miracles"
  | "parables"
  | "prophets"
  | "kings-and-queens"
  | "women-of-the-bible"
  | "children-and-young-people"
  | "places"
  | "who-said-it"
  | "finish-the-verse"
  | "general";

export const ALL_CATEGORIES: BibleCategory[] = [
  "old-testament",
  "new-testament",
  "life-of-jesus",
  "bible-characters",
  "bible-books",
  "miracles",
  "parables",
  "prophets",
  "kings-and-queens",
  "women-of-the-bible",
  "children-and-young-people",
  "places",
  "who-said-it",
  "finish-the-verse",
  "general",
];

export const CATEGORY_LABELS: Record<BibleCategory, string> = {
  "old-testament": "Old Testament",
  "new-testament": "New Testament",
  "life-of-jesus": "Life of Jesus",
  "bible-characters": "Bible Characters",
  "bible-books": "Bible Books",
  miracles: "Miracles",
  parables: "Parables",
  prophets: "Prophets",
  "kings-and-queens": "Kings and Queens",
  "women-of-the-bible": "Women of the Bible",
  "children-and-young-people": "Children and Young People",
  places: "Places",
  "who-said-it": "Who Said It?",
  "finish-the-verse": "Finish the Verse",
  general: "General Bible Knowledge",
};

export type QuestionDifficulty = "easy" | "medium" | "hard";

export type BibleQuestion = {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctAnswerIndex: number;
  bibleReference: string;
  scriptureExcerpt?: string;
  explanation: string;
  category: BibleCategory;
  difficulty: QuestionDifficulty;
  testament: "old" | "new" | "both";
  tags: string[];
  sourceTranslation?: string;
  isReviewed: boolean;
};

/** A question as sent to online clients BEFORE the reveal — no answer data. */
export type PublicQuestion = Omit<
  BibleQuestion,
  "correctAnswerIndex" | "explanation" | "scriptureExcerpt" | "bibleReference"
>;

export type BotDifficulty = "easy" | "medium" | "hard";

export type ScoringStyle = "standard" | "speed" | "streak" | "speed+streak";

export type GameSettings = {
  questionCount: number; // 1..30
  timerSeconds: 10 | 15 | 20 | 30;
  difficulty: QuestionDifficulty | "mixed";
  categories: BibleCategory[] | "mixed";
  scoringStyle: ScoringStyle;
  /** questions per round before a round-summary screen; final summary is the results screen */
  roundSize: number;
  /** seconds to auto-advance from the reveal screen (host can advance sooner online) */
  revealSeconds: number;
};

export const DEFAULT_SETTINGS: GameSettings = {
  questionCount: 10,
  timerSeconds: 15,
  difficulty: "mixed",
  categories: "mixed",
  scoringStyle: "speed",
  roundSize: 5,
  revealSeconds: 8,
};

export type PlayerColor =
  | "royal"
  | "crimson"
  | "emerald"
  | "amber"
  | "violet"
  | "teal"
  | "rose"
  | "sky";

export const PLAYER_COLORS: PlayerColor[] = [
  "royal",
  "crimson",
  "emerald",
  "amber",
  "violet",
  "teal",
  "rose",
  "sky",
];

export type PlayerAvatar = "dove" | "lamp" | "scroll" | "crown" | "star" | "harp" | "shield" | "fish";

export const PLAYER_AVATARS: PlayerAvatar[] = [
  "dove",
  "lamp",
  "scroll",
  "crown",
  "star",
  "harp",
  "shield",
  "fish",
];

export const AVATAR_EMOJI: Record<PlayerAvatar, string> = {
  dove: "🕊️",
  lamp: "🪔",
  scroll: "📜",
  crown: "👑",
  star: "⭐",
  harp: "🎻",
  shield: "🛡️",
  fish: "🐟",
};

export type GamePlayer = {
  id: string;
  name: string;
  color: PlayerColor;
  avatar: PlayerAvatar;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  connected: boolean;
};

export type AnswerRecord = {
  /** null = did not answer */
  answerIndex: number | null;
  responseMs: number | null;
  isCorrect: boolean;
  basePoints: number;
  speedBonus: number;
  streakBonus: number;
  totalPoints: number;
};

export type PlayerScoreState = {
  score: number;
  correctCount: number;
  streak: number;
  bestStreak: number;
  /** sum of response times on CORRECT answers, for tie-breaking */
  correctResponseMsTotal: number;
  answers: (AnswerRecord | null)[]; // indexed by question index
};

export type GamePhase =
  | "countdown"
  | "question"
  | "reveal"
  | "round-summary"
  | "complete";

// ── Tournament: survival elimination with a head-to-head duel final ─────────

export type GameMode = "online" | "tournament";

export const MAX_TOURNAMENT_PLAYERS = 30;
/** below this a survival field is pointless — just play a normal online game */
export const MIN_TOURNAMENT_PLAYERS = 3;
/** the field is cut down to this many finalists, who then play a sudden-death duel */
export const DUEL_FINALISTS = 2;
/** the duel is decided by outright question wins (not cumulative score): first to this many */
export const DUEL_WINS_TO_WIN = 2;

/** "field" = the whole surviving pack answers together; "duel" = the final two head-to-head */
export type TournamentStage = "field" | "duel";

export type TournamentState = {
  stage: TournamentStage;
  /** playerId → question index at which they were eliminated; survivors are absent */
  eliminatedAtIndex: Record<string, number>;
  /**
   * Target number of survivors remaining AFTER each field-stage elimination.
   * Computed once at game creation, strictly decreasing down to DUEL_FINALISTS,
   * and indexed by the number of elimination questions already resolved. Storing
   * the whole curve keeps convergence deterministic and inspectable.
   */
  survivorSchedule: number[];
  /** duel sudden-death: outright question wins per finalist, keyed by player id */
  duelWins: Record<string, number>;
  /** the crowned champion once the duel resolves */
  championId: string | null;
};

export type PendingAnswer = { answerIndex: number; responseMs: number; submittedAt: number };

export type GameState = {
  phase: GamePhase;
  settings: GameSettings;
  players: GamePlayer[];
  questions: BibleQuestion[];
  currentIndex: number;
  /** epoch ms when the current question was shown (authoritative clock) */
  questionStartedAt: number | null;
  /** epoch ms when answers lock */
  questionDeadline: number | null;
  /** epoch ms when the reveal/summary screen auto-advances (informational) */
  phaseEndsAt: number | null;
  /** answers submitted for the CURRENT question, keyed by player id */
  pendingAnswers: Record<string, PendingAnswer>;
  scores: Record<string, PlayerScoreState>;
  /** completed a full pass through the current round-summary? */
  roundJustEnded: number | null;
  winnerIds: string[] | null;
  /** present only in tournament games; drives survival elimination + the duel final */
  tournament?: TournamentState | null;
};

export type RankedPlayer = {
  player: GamePlayer;
  scoreState: PlayerScoreState;
  /** 1-based; tied players share a rank */
  rank: number;
};
