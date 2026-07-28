import type { BibleQuestion } from "@/types/game";
import { oldTestamentQuestions } from "./data/offline/old-testament";
import { newTestamentQuestions } from "./data/offline/new-testament";
import { lifeOfJesusQuestions } from "./data/offline/life-of-jesus";
import { bibleCharactersQuestions } from "./data/offline/bible-characters";
import { bibleBooksQuestions } from "./data/offline/bible-books";
import { miraclesQuestions } from "./data/offline/miracles";
import { parablesQuestions } from "./data/offline/parables";
import { prophetsQuestions } from "./data/offline/prophets";
import { kingsAndQueensQuestions } from "./data/offline/kings-and-queens";
import { womenOfTheBibleQuestions } from "./data/offline/women-of-the-bible";
import { childrenAndYoungPeopleQuestions } from "./data/offline/children-and-young-people";
import { placesQuestions } from "./data/offline/places";
import { whoSaidItQuestions } from "./data/offline/who-said-it";
import { finishTheVerseQuestions } from "./data/offline/finish-the-verse";
import { generalQuestions } from "./data/offline/general";

/**
 * Questions for Solo and Local play.
 *
 * Solo and Local grade answers on the device (they must keep working with no
 * network, as an installed PWA), so this pool ships to the browser complete
 * with `correctAnswerIndex`. Anyone can read it out of the JavaScript bundle.
 *
 * That is why it is disjoint from ONLINE_QUESTION_BANK: a question a browser
 * can already read must never decide a competitive online match. The two pools
 * live in separate module trees (`data/offline` vs `data/online`) so the split
 * survives bundling — importing one can never pull in the other.
 */
export const OFFLINE_QUESTION_BANK: BibleQuestion[] = [
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
