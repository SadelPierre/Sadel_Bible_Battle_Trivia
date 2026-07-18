"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEFAULT_SETTINGS, PLAYER_COLORS, type BotDifficulty, type GamePlayer, type GameSettings } from "@/types/game";
import { usePreferences } from "@/stores/preferences";
import { useOfflineGame } from "@/stores/offlineGame";
import { validateDisplayName } from "@/lib/validation";
import { botName } from "@/features/computer-players/bots";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/shared/Button";
import { SoundControls } from "@/components/shared/SoundControls";
import { IdentityForm } from "@/components/settings/IdentityForm";
import { GameSettingsForm } from "@/components/settings/GameSettingsForm";
import { OptionPills } from "@/components/settings/OptionPills";
import { OfflineGameView } from "@/components/game/OfflineGameView";

export default function SoloPage() {
  const router = useRouter();
  const prefs = usePreferences();
  const game = useOfflineGame((s) => s.game);
  const start = useOfflineGame((s) => s.start);

  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [botCount, setBotCount] = useState<1 | 2 | 3>(2);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("medium");
  const [nameError, setNameError] = useState<string | null>(null);

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
    const result = validateDisplayName(prefs.displayName || "Player 1");
    if (!result.ok) {
      setNameError(result.error);
      return;
    }
    setNameError(null);
    const human: GamePlayer = {
      id: "human-1",
      name: result.name,
      color: prefs.color,
      avatar: prefs.avatar,
      isBot: false,
      connected: true,
    };
    const bots: GamePlayer[] = Array.from({ length: botCount }, (_, i) => ({
      id: `bot-${i + 1}`,
      name: botName(i),
      color: PLAYER_COLORS.filter((c) => c !== prefs.color)[i]!,
      avatar: (["scroll", "lamp", "star"] as const)[i]!,
      isBot: true,
      botDifficulty,
      connected: true,
    }));
    start({ mode: "solo", localStyle: "shared", settings, players: [human, ...bots] });
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-bbl-muted hover:text-bbl-gold">
          ← Home
        </Link>
        <SoundControls />
      </div>
      <h1 className="mt-4 text-3xl font-black text-bbl-gold">🤖 Play Against Computer</h1>

      <Card className="mt-6 p-5">
        <IdentityForm
          name={prefs.displayName}
          avatar={prefs.avatar}
          color={prefs.color}
          error={nameError}
          onChange={(v) => prefs.setIdentity(v.name, v.avatar, v.color)}
        />
      </Card>

      <Card className="mt-4 space-y-5 p-5">
        <OptionPills
          label="Computer opponents"
          options={[1, 2, 3] as const}
          value={botCount}
          onChange={setBotCount}
          renderLabel={(v) => `${v} bot${v > 1 ? "s" : ""}`}
        />
        <OptionPills
          label="Computer difficulty"
          options={["easy", "medium", "hard"] as const}
          value={botDifficulty}
          onChange={setBotDifficulty}
          renderLabel={(v) => (v === "easy" ? "😌 Easy" : v === "medium" ? "🙂 Medium" : "😎 Hard")}
        />
      </Card>

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
