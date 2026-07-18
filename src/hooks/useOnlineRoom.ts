"use client";

/**
 * Live room state: polls the authoritative snapshot and additionally listens
 * on Supabase Realtime for "sync" events to refetch immediately. Polling is
 * the reliability floor (2s during play, 4s in the lobby); realtime makes it
 * feel instant.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomSnapshot } from "@/features/online/types";
import {
  fetchSnapshot,
  loadCredentials,
  OnlineError,
  type RoomCredentials,
} from "@/features/online/client";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function useOnlineRoom(code: string) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<OnlineError | null>(null);
  const credsRef = useRef<RoomCredentials | null>(null);
  const snapshotRef = useRef<RoomSnapshot | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      credsRef.current = credsRef.current ?? loadCredentials(code);
      const snap = await fetchSnapshot(code, credsRef.current);
      snapshotRef.current = snap;
      setSnapshot(snap);
      setError(null);
    } catch (e) {
      if (e instanceof OnlineError) {
        // room gone/expired/etc: surface; transient network errors keep old state
        if (e.status !== 429) setError(e);
      }
    } finally {
      inFlight.current = false;
    }
  }, [code]);

  // polling loop with phase-aware cadence
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      await refresh();
      if (stopped) return;
      const snap = snapshotRef.current;
      const playing = snap?.status === "playing";
      timer = setTimeout(loop, playing ? 2000 : 4000);
    };
    void loop();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [refresh]);

  // realtime nudge: refetch as soon as the server writes a sync event
  useEffect(() => {
    const roomId = snapshot?.roomId;
    if (!roomId) return;
    const supabase = supabaseBrowser();
    if (!supabase) return;
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_events", filter: `room_id=eq.${roomId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [snapshot?.roomId, refresh]);

  // refresh when the tab returns to the foreground (mobile background handling)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  return {
    snapshot,
    error,
    refresh,
    credentials: credsRef.current ?? (typeof window !== "undefined" ? loadCredentials(code) : null),
  };
}
