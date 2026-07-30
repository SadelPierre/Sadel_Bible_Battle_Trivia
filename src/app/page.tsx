"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { BRAND } from "@/lib/branding";
import { BackgroundDecor } from "@/components/shared/BackgroundDecor";
import { SoundControls } from "@/components/shared/SoundControls";
import { Card } from "@/components/shared/Card";

const MODES = [
  {
    href: "/play/local",
    emoji: "🛋️",
    title: "Local Multiplayer",
    desc: "2 to 4 players on one device. Shared screen or pass and play.",
  },
  {
    href: "/online",
    emoji: "🌍",
    title: "Online Multiplayer",
    desc: "Private rooms with a code. Play with friends anywhere.",
  },
];

const EASE = [0.16, 1, 0.3, 1] as const;

export default function LandingPage() {
  const reduce = useReducedMotion();
  /** Entry animation, disabled wholesale when the user asks for less motion. */
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: EASE },
        };

  return (
    <main className="relative mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-4 pb-12 pt-10 md:justify-center md:pt-16">
      <BackgroundDecor />
      <div className="absolute right-4 top-4 z-10">
        <SoundControls />
      </div>

      {/* Hero: asymmetric split. Copy carries the left, the mark anchors the right. */}
      <section className="grid items-center gap-8 md:grid-cols-[1.15fr_0.85fr] md:gap-12">
        <motion.div {...rise(0)}>
          <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-bbl-gold sm:text-6xl">
            {BRAND.name}
          </h1>
          <p className="mt-4 max-w-[36ch] text-lg leading-relaxed text-bbl-muted">
            {BRAND.tagline}
          </p>

          <div className="mt-7">
            <Link
              href="/play/solo"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-bbl-gold px-7 py-3.5 text-lg font-bold text-[#2a1b0a] shadow-lg shadow-bbl-gold/25 transition-all duration-150 hover:brightness-110 active:scale-[0.97]"
            >
              <span aria-hidden>🤖</span>
              Play Against Computer
            </Link>
            <p className="mt-3 text-sm text-bbl-muted">
              Face 1 to 3 computer opponents at the difficulty you pick.
            </p>
          </div>
        </motion.div>

        <motion.div
          {...rise(0.12)}
          aria-hidden
          className="order-first flex items-center justify-center md:order-none"
        >
          <div className="flex aspect-square w-40 items-center justify-center rounded-[2rem] border border-bbl-border bg-bbl-card text-7xl shadow-xl shadow-black/30 sm:w-52 sm:text-8xl">
            <span className="bbl-glow-gold">{BRAND.logoEmoji}</span>
          </div>
        </motion.div>
      </section>

      {/* Two remaining play modes. Exactly two items, exactly two cells. */}
      <section className="mt-14 grid gap-4 sm:grid-cols-2">
        {MODES.map((mode, i) => (
          <motion.div
            key={mode.href}
            initial={reduce ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
          >
            <Link href={mode.href} className="block h-full">
              <Card className="h-full p-5 transition-all duration-150 hover:-translate-y-1 hover:border-bbl-gold hover:shadow-bbl-gold/10">
                <div className="text-4xl" aria-hidden>
                  {mode.emoji}
                </div>
                <h2 className="font-display mt-2 text-xl font-bold">{mode.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-bbl-muted">{mode.desc}</p>
              </Card>
            </Link>
          </motion.div>
        ))}
      </section>

      <div className="mt-10 flex flex-col items-start gap-3 border-t border-bbl-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/how-to-play"
          className="text-sm font-semibold text-bbl-gold underline-offset-4 hover:underline"
        >
          How to Play
        </Link>
        <p className="text-xs text-bbl-muted">
          Family-friendly Bible trivia · Great for churches, youth groups, and game nights
        </p>
      </div>
    </main>
  );
}
