import "server-only";

import type { BibleQuestion } from "@/types/game";
import { OFFLINE_QUESTION_BANK } from "./offline-bank";
import { oldTestamentQuestions } from "./data/online/old-testament";
import { newTestamentQuestions } from "./data/online/new-testament";
import { lifeOfJesusQuestions } from "./data/online/life-of-jesus";
import { bibleCharactersQuestions } from "./data/online/bible-characters";
import { bibleBooksQuestions } from "./data/online/bible-books";
import { miraclesQuestions } from "./data/online/miracles";
import { parablesQuestions } from "./data/online/parables";
import { prophetsQuestions } from "./data/online/prophets";
import { kingsAndQueensQuestions } from "./data/online/kings-and-queens";
import { womenOfTheBibleQuestions } from "./data/online/women-of-the-bible";
import { childrenAndYoungPeopleQuestions } from "./data/online/children-and-young-people";
import { placesQuestions } from "./data/online/places";
import { whoSaidItQuestions } from "./data/online/who-said-it";
import { finishTheVerseQuestions } from "./data/online/finish-the-verse";
import { generalQuestions } from "./data/online/general";

/**
 * Questions for competitive online rooms. SERVER ONLY.
 *
 * The `server-only` import above turns any client import of this module into a
 * build error. That guard is the whole point: online snapshots deliberately
 * strip `correctAnswerIndex` while a question is live, and that stripping is
 * worthless if the browser can look the answer up in a bundled copy of the
 * bank. This pool is disjoint from OFFLINE_QUESTION_BANK for the same reason.
 */
export const ONLINE_QUESTION_BANK: BibleQuestion[] = [
  ...oldTestamentQuestions,
  ...newTestamentQuestions,
  ...lifeOfJesusQuestions,
  ...bibleCharactersQuestions,
  ...bibleBooksQuestions,
  ...miraclesQuestions,
  ...parablesQuestions,
  ...prophetsQuestions,
  ...kingsAndQueensQuestions,
  ...womenOfTheBibleQuestions,
  ...childrenAndYoungPeopleQuestions,
  ...placesQuestions,
  ...whoSaidItQuestions,
  ...finishTheVerseQuestions,
  ...generalQuestions,
];

/**
 * Both pools together. For validation, admin tooling, and the `bible_questions`
 * seed — never for choosing the questions of a live match.
 */
export const QUESTION_BANK: BibleQuestion[] = [
  ...OFFLINE_QUESTION_BANK,
  ...ONLINE_QUESTION_BANK,
];

export function questionById(id: string): BibleQuestion | undefined {
  return QUESTION_BANK.find((q) => q.id === id);
}
