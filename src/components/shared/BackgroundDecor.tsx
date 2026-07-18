/** Subtle floating Bible-themed background decorations (pure CSS animation). */
const DECOR = [
  { emoji: "✨", top: "12%", left: "8%", delay: "0s", size: "text-2xl" },
  { emoji: "🕊️", top: "20%", left: "85%", delay: "1.5s", size: "text-3xl" },
  { emoji: "⭐", top: "70%", left: "12%", delay: "3s", size: "text-xl" },
  { emoji: "📜", top: "78%", left: "88%", delay: "2s", size: "text-2xl" },
  { emoji: "👑", top: "45%", left: "94%", delay: "4s", size: "text-xl" },
  { emoji: "🪔", top: "60%", left: "4%", delay: "0.8s", size: "text-2xl" },
];

export function BackgroundDecor() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden opacity-30">
      {DECOR.map((d, i) => (
        <span
          key={i}
          className={`bbl-float absolute ${d.size}`}
          style={{ top: d.top, left: d.left, animationDelay: d.delay }}
        >
          {d.emoji}
        </span>
      ))}
    </div>
  );
}
