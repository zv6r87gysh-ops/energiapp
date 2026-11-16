"use client";
import { useCallback, useEffect, useState } from "react";
import { loginFeedback } from "./login-feedback";
import type {
  Activation,
  CloudStatus,
  MoodResult,
  SonosCatalog,
} from "./contracts";
export function useMusic(householdId: string, enabled: boolean) {
  const [connection, setConnection] = useState<{
    home: string;
    data: CloudStatus;
  } | null>(null);
  const [catalog, setCatalog] = useState<{
    home: string;
    data: SonosCatalog;
  } | null>(null);
  const [catalogMessage, setCatalogMessage] = useState("");
  const loadSonosCatalog = useCallback(
    async (room: string) => {
      setCatalogMessage("Hämtar Sonos-musik…");
      setCatalog(null);
      try {
        const r = await fetch(
          `/api/music/sonos?${new URLSearchParams({ householdId, room })}`,
          { cache: "no-store", signal: AbortSignal.timeout(30000) },
        );
        const data = await r.json();
        if (!r.ok || !Array.isArray(data.items))
          throw Error(data.message ?? "Sonos-musiken kunde inte hämtas.");
        setCatalog({ home: householdId, data });
        setCatalogMessage(data.messages.join(" "));
      } catch (e) {
        setCatalogMessage(
          e instanceof Error ? e.message : "Sonos-musiken kunde inte hämtas.",
        );
      }
    },
    [householdId],
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    queueMicrotask(() =>
      setLoginMessage(loginFeedback(query.get("music"), query.get("provider"))),
    );
  }, []);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const r = await fetch(
        `/api/music?householdId=${encodeURIComponent(householdId)}`,
        { cache: "no-store", signal: AbortSignal.timeout(15000) },
      );
      if (!r.ok) throw Error("Musikanslutningen kunde inte kontrolleras.");
      const data = await r.json();
      if (
        !data.sonos ||
        !data.spotify ||
        !Array.isArray(data.rooms) ||
        !Array.isArray(data.devices)
      )
        throw Error("Musikanslutningen kunde inte verifieras.");
      setConnection({ home: householdId, data });
      setMessage(data.message ?? "");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Musikanslutningen kunde inte kontrolleras.",
      );
    }
  }, [householdId, enabled]);
  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);
  async function activate(input: Activation): Promise<MoodResult | null> {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(60000),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.message ?? "Musiken kunde inte startas.");
      if (
        !data.playlist?.name ||
        !["playing", "requested"].includes(data.music?.status)
      )
        throw Error("Svaret kunde inte verifieras. Kontrollera spelaren.");
      return data;
    } catch (error) {
      setMessage(
        error instanceof Error &&
          error.name !== "TimeoutError" &&
          error.name !== "AbortError"
          ? error.message
          : "Starten kunde inte bekräftas. Kontrollera Sonos innan du försöker igen.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function pause(room: string, action: "pause" | "next" = "pause") {
    setMessage("");
    setBusy(true);
    try {
      const r = await fetch("/api/music", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId, room, action }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.message ?? "Kommandot kunde inte utföras.");
    } catch (error) {
      setMessage(
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "Kommandot kunde inte bekräftas. Kontrollera Sonos.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/music", { method: "DELETE" });
      await refresh();
    } catch {
      setMessage("Kontona kunde inte kopplas från. Försök igen.");
    } finally {
      setBusy(false);
    }
  }
  return {
    status: connection?.home === householdId ? connection.data : null,
    catalog: catalog?.home === householdId ? catalog.data : null,
    catalogMessage,
    loadSonosCatalog,
    busy,
    message,
    loginMessage,
    refresh,
    activate,
    pause,
    disconnect,
  };
}
export type MusicController = ReturnType<typeof useMusic>;
