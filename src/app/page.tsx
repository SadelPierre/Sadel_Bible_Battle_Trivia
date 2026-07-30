"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BRAND } from "@/lib/branding";
import { BackgroundDecor } from "@/components/shared/BackgroundDecor";
import { SoundControls } from "@/components/shared/SoundControls";
import { Card } from "@/components/shared/Card";

const MODES = [
  {
    href: "/play/solo",
    emoji: "🤖",
    title: "Play Against Computer",
    desc: "Face 1–3 computer opponents with adjustable difficulty",
  },
  {
    href: "/play/local",
    emoji: "🛋️",
    title: "Local Multiplayer",
    desc: "2–4 players on one device — shared screen or pass-and-play",
  },
  {
    href: "/online",
    emoji: "🌍",
    title: "Online Multiplayer",
    desc: "Private rooms with a code — play with friends anywhere",
  },
  {
    href: "/how-to-play",
    emoji: "❓",
    title: "How to Play",
    desc: "Rules, scoring, and tips",
  },
];

export default function LandingPage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center px-4 py-8">
      <BackgroundDecor />
      <div className="absolute right-4 top-4 z-10">
        <SoundControls />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-10 text-center"
      >
        <div className="text-7xl" aria-hidden>
          {BRAND.logoEmoji}
        </div>
        <h1 className="mt-3 bg-gradient-to-r from-bbl-gold via-yellow-200 to-bbl-gold bg-clip-text text-5xl font-black text-transparent sm:text-6xl">
          {BRAND.name}
        </h1>
        <p className="mt-3 text-lg text-bbl-muted">{BRAND.tagline}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-10 grid w-full gap-4 sm:grid-cols-2"
      >
        {MODES.map((mode, i) => (
          <motion.div
            key={mode.href}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.08 }}
          >
            <Link href={mode.href} className="block h-full">
              <Card className="h-full p-5 transition-all hover:-translate-y-1 hover:border-bbl-gold hover:shadow-bbl-gold/10">
                <div className="text-4xl" aria-hidden>
                  {mode.emoji}
                </div>
                <h2 className="mt-2 text-xl font-bold">{mode.title}</h2>
                <p className="mt-1 text-sm text-bbl-muted">{mode.desc}</p>
              </Card>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      <p className="mt-10 text-center text-xs text-bbl-muted">
        Family-friendly Bible trivia · Great for churches, youth groups, and game nights
      </p>
    </main>
  );
}
