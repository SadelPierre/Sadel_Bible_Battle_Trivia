import type { BibleQuestion } from "@/types/game";
import { oldTestamentQuestions } from "./data/old-testament";
import { newTestamentQuestions } from "./data/new-testament";
import { lifeOfJesusQuestions } from "./data/life-of-jesus";
import { bibleCharactersQuestions } from "./data/bible-characters";
import { bibleBooksQuestions } from "./data/bible-books";
import { miraclesQuestions } from "./data/miracles";
import { parablesQuestions } from "./data/parables";
import { prophetsQuestions } from "./data/prophets";
import { kingsAndQueensQuestions } from "./data/kings-and-queens";
import { womenOfTheBibleQuestions } from "./data/women-of-the-bible";
import { childrenAndYoungPeopleQuestions } from "./data/children-and-young-people";
import { placesQuestions } from "./data/places";
import { whoSaidItQuestions } from "./data/who-said-it";
import { finishTheVerseQuestions } from "./data/finish-the-verse";
import { generalQuestions } from "./data/general";

/** The full reviewed seed bank. Extend by adding files under ./data. */
export const QUESTION_BANK: BibleQuestion[] = [
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

export function questionById(id: string): BibleQuestion | undefined {
  return QUESTION_BANK.find((q) => q.id === id);
}
