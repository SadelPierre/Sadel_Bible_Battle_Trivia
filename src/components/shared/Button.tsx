"use client";

import { forwardRef } from "react";
import { audio } from "@/features/audio/audio";

type Variant = "primary" | "gold" | "ghost" | "danger" | "answer";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-bbl-primary hover:bg-[#8d70ff] text-white shadow-lg shadow-bbl-primary/25 border border-transparent",
  gold: "bg-bbl-gold hover:brightness-110 text-[#2a1b0a] font-bold shadow-lg shadow-bbl-gold/25 border border-transparent",
  ghost:
    "bg-transparent hover:bg-white/10 text-bbl-text border border-bbl-border",
  danger: "bg-bbl-incorrect/80 hover:bg-bbl-incorrect text-white border border-transparent",
  answer:
    "bg-bbl-card hover:bg-bbl-primary-soft text-bbl-text border-2 border-bbl-border hover:border-bbl-primary text-left",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-5 py-2.5 text-base rounded-xl",
  lg: "px-7 py-3.5 text-lg rounded-2xl",
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  silent?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", silent = false, className = "", onClick, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      onClick={(e) => {
        // every click is a user gesture: unlock audio, then play the cue
        audio.unlock();
        if (!silent) audio.play("click");
        onClick?.(e);
      }}
      {...rest}
    />
  );
});
