"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOnlineRoom } from "@/hooks/useOnlineRoom";
import { clearCredentials, roomActions } from "@/features/online/client";
import { normalizeRoomCode } from "@/lib/validation";
import { OnlineLobby } from "@/components/lobby/OnlineLobby";
import { OnlineGameView } from "@/components/game/OnlineGameView";
import { SoundControls } from "@/components/shared/SoundControls";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/shared/Button";

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = normalizeRoomCode(rawCode);
  const router = useRouter();
  const { snapshot, error, refresh, credentials } = useOnlineRoom(code);

  const clearAndGoHome = () => {
    clearCredentials(code);
    router.push("/");
  };

  const leaveDuringGame = () => {
    if (!credentials) {
      clearAndGoHome();
      return;
    }
    // Best effort: never trap someone on the results screen if the network is
    // down, but tell the server immediately when it is reachable.
    void roomActions
      .leave(code, credentials)
      .catch(() => undefined)
      .finally(clearAndGoHome);
  };

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
        <Card className="w-full p-6 text-center">
          <div className="text-4xl" aria-hidden>
            🚪
          </div>
          <h1 className="mt-2 text-xl font-bold">Can&apos;t open room {code}</h1>
          <p className="mt-2 text-sm text-bbl-muted">{error.message}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/online">
              <Button variant="gold">Try another room</Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">Home</Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse text-bbl-muted">Connecting to room {code}…</p>
      </main>
    );
  }

  // visitor without a seat (e.g. opened a shared /room link directly)
  if (!snapshot.myPlayerId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
        <Card className="w-full p-6 text-center">
          <h1 className="text-xl font-bold">Join room {code}?</h1>
          <p className="mt-2 text-sm text-bbl-muted">
            Enter your name on the next screen to take a seat.
          </p>
          <Link href={`/online?code=${code}`}>
            <Button variant="gold" className="mt-4">
              Enter your name →
            </Button>
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-bold text-bbl-muted">
          Room <span className="tracking-widest text-bbl-gold">{snapshot.code}</span>
        </span>
        <SoundControls />
      </div>
      {snapshot.status === "lobby" || !snapshot.game ? (
        <OnlineLobby
          snapshot={snapshot}
          creds={credentials!}
          onLeft={clearAndGoHome}
          refresh={refresh}
        />
      ) : (
        <OnlineGameView
          snapshot={snapshot}
          creds={credentials!}
          refresh={refresh}
          onLeft={leaveDuringGame}
        />
      )}
    </main>
  );
}
