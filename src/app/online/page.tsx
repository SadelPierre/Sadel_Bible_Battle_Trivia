"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { usePreferences } from "@/stores/preferences";
import { validateDisplayName, normalizeRoomCode, ROOM_CODE_LENGTH } from "@/lib/validation";
import { createRoomApi, joinRoomApi, OnlineError } from "@/features/online/client";
import { isSupabaseBrowserConfigured } from "@/lib/supabase/browser";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/shared/Button";
import { SoundControls } from "@/components/shared/SoundControls";
import { IdentityForm } from "@/components/settings/IdentityForm";

function OnlineSetup() {
  const router = useRouter();
  const search = useSearchParams();
  const prefs = usePreferences();
  const [joinCode, setJoinCode] = useState(normalizeRoomCode(search.get("code") ?? ""));
  const [nameError, setNameError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);

  const configured = isSupabaseBrowserConfigured();

  const identityOrError = () => {
    const result = validateDisplayName(prefs.displayName);
    if (!result.ok) {
      setNameError(result.error);
      return null;
    }
    setNameError(null);
    return { name: result.name, avatar: prefs.avatar, color: prefs.color };
  };

  const handleCreate = async () => {
    const identity = identityOrError();
    if (!identity) return;
    setBusy("create");
    setApiError(null);
    try {
      const { code } = await createRoomApi(identity);
      router.push(`/room/${code}`);
    } catch (e) {
      setApiError(e instanceof OnlineError ? e.message : "Could not create the room.");
      setBusy(null);
    }
  };

  const handleJoin = async () => {
    const identity = identityOrError();
    if (!identity) return;
    const code = normalizeRoomCode(joinCode);
    if (code.length !== ROOM_CODE_LENGTH) {
      setApiError(`Room codes are ${ROOM_CODE_LENGTH} letters/numbers, like K7M3P.`);
      return;
    }
    setBusy("join");
    setApiError(null);
    try {
      await joinRoomApi(code, identity);
      router.push(`/room/${code}`);
    } catch (e) {
      setApiError(e instanceof OnlineError ? e.message : "Could not join the room.");
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold text-bbl-muted hover:text-bbl-gold">
          ← Home
        </Link>
        <SoundControls />
      </div>
      <h1 className="mt-4 text-3xl font-black text-bbl-gold">🌍 Online Multiplayer</h1>

      {!configured && (
        <Card className="mt-6 border-bbl-gold/50 p-5">
          <h2 className="font-bold text-bbl-gold">⚠️ Online play is not configured</h2>
          <p className="mt-2 text-sm text-bbl-muted">
            This deployment has no Supabase project connected. Add{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
            <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, and{" "}
            <code>SUPABASE_SECRET_KEY</code> to your environment (see SETUP.md), then restart.
            Solo and local multiplayer work without it!
          </p>
        </Card>
      )}

      <Card className="mt-6 p-5">
        <IdentityForm
          name={prefs.displayName}
          avatar={prefs.avatar}
          color={prefs.color}
          error={nameError}
          onChange={(v) => prefs.setIdentity(v.name, v.avatar, v.color)}
        />
      </Card>

      {apiError && (
        <p role="alert" className="mt-4 rounded-xl border border-bbl-incorrect/50 bg-bbl-incorrect/10 p-3 text-sm font-semibold text-bbl-incorrect">
          {apiError}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-5 text-center">
          <h2 className="text-lg font-bold">Create a room</h2>
          <p className="mt-1 text-xs text-bbl-muted">
            You become the host and get a code to share
          </p>
          <Button
            variant="gold"
            className="mt-4 w-full"
            disabled={busy !== null}
            onClick={handleCreate}
          >
            {busy === "create" ? "Creating…" : "✨ Create room"}
          </Button>
        </Card>
        <Card className="p-5 text-center">
          <h2 className="text-lg font-bold">Join a room</h2>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
            placeholder="CODE"
            maxLength={ROOM_CODE_LENGTH}
            aria-label="Room code"
            className="mt-2 w-full rounded-xl border-2 border-bbl-border bg-bbl-bg px-4 py-2 text-center text-2xl font-black tracking-[0.3em] uppercase placeholder:text-bbl-muted/40 focus:border-bbl-gold focus:outline-none"
          />
          <Button className="mt-3 w-full" disabled={busy !== null} onClick={handleJoin}>
            {busy === "join" ? "Joining…" : "🚪 Join room"}
          </Button>
        </Card>
      </div>
    </main>
  );
}

export default function OnlinePage() {
  return (
    <Suspense>
      <OnlineSetup />
    </Suspense>
  );
}
