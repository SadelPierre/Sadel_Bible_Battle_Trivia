"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { audio } from "@/features/audio/audio";
import type { GamePlayer } from "@/types/game";
import { PlayerChip } from "@/components/shared/PlayerChip";

/** "Get Ready" screen with an animated 3-2-1 countdown driven by an absolute end time. */
export function Countdown({ endsAt, players }: { endsAt: number | null; players: GamePlayer[] }) {
  const [display, setDisplay] = useState(3);
  const lastTick = useRef(-1);

  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, endsAt - Date.now());
      const n = Math.min(3, Math.max(1, Math.ceil(remaining / 1000)));
      setDisplay(n);
      if (n !== lastTick.current) {
        lastTick.current = n;
        audio.play("countdownTick");
      }
    }, 80);
    return () => clearInterval(id);
  }, [endsAt]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8">
      <h2 className="text-3xl font-bold text-bbl-gold bbl-glow-gold">Get Ready!</h2>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={display}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="text-8xl font-black text-bbl-text"
          aria-live="assertive"
        >
          {display}
        </motion.div>
      </AnimatePresence>
      <div className="flex max-w-lg flex-wrap justify-center gap-2">
        {players.map((p) => (
          <PlayerChip key={p.id} player={p} />
        ))}
      </div>
    </div>
  );
}
