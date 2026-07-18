import Link from "next/link";
import { Card } from "@/components/shared/Card";
import { BRAND } from "@/lib/branding";

export const metadata = { title: `How to Play — ${BRAND.name}` };

const SECTIONS: { title: string; emoji: string; body: string[] }[] = [
  {
    title: "Game Modes",
    emoji: "🎮",
    body: [
      "Play Against Computer: you vs 1–3 computer opponents (Easy, Medium, or Hard).",
      "Local Multiplayer: 2–4 players on one device. Shared Screen shows everyone the question at once with a labeled answer row per player; Pass-and-Play hands the device around so each player answers privately with their own timer.",
      "Online Multiplayer: create a private room, share the 5-letter code or invite link, and play live with 2–4 players. The host can fill empty seats with computer players.",
    ],
  },
  {
    title: "Answering & the Timer",
    emoji: "⏱️",
    body: [
      "Each question shows four choices and a countdown ring. Answer before the timer reaches zero — the ring turns gold at 5 seconds and red for the final 3.",
      "When time runs out, answers lock automatically. After everyone answers (or time expires) the correct answer is revealed with its Bible reference and a short explanation.",
    ],
  },
  {
    title: "Scoring",
    emoji: "🏅",
    body: [
      "Correct answer: 100 points. Wrong or no answer: 0 points.",
      "Speed Bonus (optional): up to 50 extra points — the faster you answer correctly, the more you earn.",
      "Streak Bonus (optional): 2 correct in a row earns +10, then +20, +30… capped at +50 per question.",
      "Ties are broken by total score, then number of correct answers, then fastest average correct-answer time. Players still tied share the same rank.",
    ],
  },
  {
    title: "Online Rooms",
    emoji: "🔑",
    body: [
      "One player creates a room and becomes host. Share the room code (like K7M3P) or copy the invite link.",
      "Everyone marks Ready; the host picks the settings and starts the game. Timers are synchronized by the server, so everyone plays fair.",
      "Dropped connection? Reopen the same link and you'll rejoin your seat while the game continues.",
    ],
  },
  {
    title: "Computer Opponents",
    emoji: "🤖",
    body: [
      "Easy bots answer slowly and get roughly half right. Medium bots are steadier. Hard bots are fast and right most of the time — but nobody is perfect!",
    ],
  },
  {
    title: "Sound & Accessibility",
    emoji: "♿",
    body: [
      "Use the 🔊 button to mute everything, and ⚙️ for separate music and effects volume plus a Reduce Motion option (your system's reduced-motion setting is respected automatically).",
      "The whole game works with a keyboard: Tab to move, Enter/Space to choose. In shared-screen mode each player has their own answer keys (1234, QWER, ASDF, ZXCV).",
      "Correct and incorrect answers are always shown with icons and text, never color alone.",
    ],
  },
];

export default function HowToPlayPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="text-sm font-semibold text-bbl-muted hover:text-bbl-gold">
        ← Back to home
      </Link>
      <h1 className="mt-4 text-4xl font-black text-bbl-gold">How to Play</h1>
      <div className="mt-6 space-y-4">
        {SECTIONS.map((s) => (
          <Card key={s.title} className="p-5">
            <h2 className="text-xl font-bold">
              <span aria-hidden>{s.emoji}</span> {s.title}
            </h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-bbl-text/90">
              {s.body.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </main>
  );
}
