"use client";

import { AnimatePresence, motion } from "framer-motion";
import { DUR, EASE_OUT } from "@/lib/motion";

/**
 * Label for a copy-to-clipboard button. Reserves a fixed width so the confirmed
 * state cannot resize the button and shove its neighbours, and cross-fades the
 * two labels. Kept under 160ms: this is confirmation, it must not feel delayed.
 */
export function CopyLabel({
  copied,
  idle,
  done = "Copied ✓",
}: {
  copied: boolean;
  idle: string;
  done?: string;
}) {
  return (
    <span className="relative inline-flex items-center justify-center">
      {/* invisible sizer: holds the width of whichever label is wider */}
      <span aria-hidden className="invisible whitespace-nowrap">
        {idle.length >= done.length ? idle : done}
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "done" : "idle"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: DUR.press, ease: EASE_OUT }}
          className="absolute inset-0 flex items-center justify-center whitespace-nowrap"
        >
          {copied ? done : idle}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
