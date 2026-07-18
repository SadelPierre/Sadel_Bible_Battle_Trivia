"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DEFAULT_SETTINGS,
  PLAYER_AVATARS,
  PLAYER_COLORS,
  type GamePlayer,
  type GameSettings,
} from "@/types/game";
import { useOfflineGame, type LocalStyle } from "@/stores/offlineGame";
import { validateDisplayName } from "@/lib/validation";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/shared/Button";
import { SoundControls } from "@/components/shared/SoundControls";
import { GameSettingsForm } from "@/components/settings/GameSettingsForm";
import { OptionPills } from "@/components/settings/OptionPills";
import { IdentityForm } from "@/components/settings/IdentityForm";
import { OfflineGameView } from "@/components/game/OfflineGameView";

type Draft = { name: string; avatar: (typeof PLAYER_AVATARS)[number]; color: (typeof PLAYER_COLORS)[number] };

const DEFAULT_DRAFTS: Draft[] = [
  { name: "", avatar: "dove", color: "royal" },
  { name: "", avatar: "crown", color: "crimson" },
  { name: "", avatar: "star", color: "emerald" },
  { name: "", avatar: "lamp", color: "amber" },
];

export default function LocalPage() {
  const router = useRouter();
  const game = useOfflineGame((s) => s.game);
  const start = useOfflineGame((s) => s.start);

  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(2);
  const [style, setStyle] = useState<LocalStyle>("shared");
  const [drafts, setDrafts] = useState<Draft[]>(DEFAULT_DRAFTS);
  const [errors, setErrors] = useState<(string | null)[]>([null, null, null, null]);

  if (game) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-4 py-6">
        <div className="mb-4 flex justify-end">
          <SoundControls />
        </div>
        <OfflineGameView onExit={() => router.push("/")} />
      </main>
    );
  }

  const handleStart = () => {
    const nextErrors: (string | null)[] = [null, null, null, null];
    const players: GamePlayer[] = [];
    const usedNames = new Set<string>();
    let ok = true;
    for (let i = 0; i < playerCount; i++) {
      const d = drafts[i]!;
      const result = validateDisplayName(d.name || `Player ${i + 1}`);
      if (!result.ok) {
        nextErrors[i] = result.error;
        ok = false;
        continue;
      }
      let name = result.name;
      // duplicate names on one device: disambiguate rather than block
      while (usedNames.has(name.toLowerCase())) name = `${name} ✦`;
      usedNames.add(name.toLowerCase());
      players.push({
        id: `local-${i + 1}`,
        name,
        avatar: d.avatar,
        color: d.color,
        isBot: false,
        connected: true,
      });
    }
    setErrors(nextErrors);
    if (!ok) return;
    start({ mode: "local", localStyle: style, settings, players });
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-bbl-muted hover:text-bbl-gold">
          ← Home
        </Link>
        <SoundControls />
      </div>
      <h1 className="mt-4 text-3xl font-black text-bbl-gold">🛋️ Local Multiplayer</h1>

      <Card className="mt-6 space-y-5 p-5">
        <OptionPills
          label="Players on this device"
          options={[2, 3, 4] as const}
          value={playerCount}
          onChange={setPlayerCount}
          renderLabel={(v) => `${v} players`}
        />
        <OptionPills
          label="Play style"
          options={["shared", "pass"] as const}
          value={style}
          onChange={setStyle}
          renderLabel={(v) =>
            v === "shared" ? "🖥️ Shared screen (race together)" : "🤝 Pass-and-play (take turns)"
          }
        />
        <p className="text-xs text-bbl-muted">
          {style === "shared"
            ? "Everyone sees the question at once — each player has their own labeled answer row (and keyboard keys)."
            : "The device is handed around. Each player confirms before seeing the question, with a fresh timer each turn."}
        </p>
      </Card>

      {Array.from({ length: playerCount }, (_, i) => (
        <Card key={i} className="mt-4 p-5">
          <h2 className="mb-3 text-lg font-bold">Player {i + 1}</h2>
          <IdentityForm
            label="Display name"
            name={drafts[i]!.name}
            avatar={drafts[i]!.avatar}
            color={drafts[i]!.color}
            error={errors[i]}
            takenColors={drafts.filter((_, j) => j !== i && j < playerCount).map((d) => d.color)}
            onChange={(v) =>
              setDrafts((prev) =>
                prev.map((d, j) => (j === i ? { name: v.name, avatar: v.avatar, color: v.color } : d)),
              )
            }
          />
        </Card>
      ))}

      <Card className="mt-4 p-5">
        <GameSettingsForm settings={settings} onChange={setSettings} />
      </Card>

      <div className="mt-6 text-center">
        <Button variant="gold" size="lg" onClick={handleStart}>
          ▶ Start Game
        </Button>
      </div>
    </main>
  );
}
