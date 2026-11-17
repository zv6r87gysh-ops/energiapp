"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { SkipBack, SkipForward, Play, Pause, Minus, Plus } from "lucide-react";
import type { PlayerState, PlayerCommand } from "@/lib/moods/player";
const time = (ms: number | null) =>
  ms === null
    ? "–:––"
    : `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
export function MusicPlayer({
  home,
  room,
  revision,
}: {
  home: string;
  room: string;
  revision: number;
}) {
  const polling = useRef(false);
  const [sample, setSample] = useState<{
    key: string;
    data: PlayerState;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [seek, setSeek] = useState<{ item: string; value: number } | null>(
    null,
  );
  const key = `${home}/${room}`;
  const state = sample?.key === key ? sample.data : null;
  const fresh = !!state && now - state.sampledAt < 20000;
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (polling.current) return;
      polling.current = true;
      try {
        const r = await fetch(
          `/api/music/player?${new URLSearchParams({ householdId: home, room })}`,
          { cache: "no-store", signal: signal ?? AbortSignal.timeout(12000) },
        );
        const data = await r.json();
        if (!r.ok)
          throw Error(data.message ?? "Spelarstatus kunde inte hämtas.");
        if (data.room !== room || !Number.isFinite(data.sampledAt))
          throw Error("Spelarstatus kunde inte verifieras.");
        setSample({ key: `${home}/${room}`, data });
        setError("");
        setNow(Date.now());
      } catch (e) {
        if (!(e instanceof Error && e.name === "AbortError"))
          setError(e instanceof Error ? e.message : "Sonos kunde inte läsas.");
      } finally {
        polling.current = false;
      }
    },
    [home, room],
  );
  useEffect(() => {
    const abort = new AbortController();
    const update = () => {
      if (!document.hidden) void refresh(abort.signal);
    };
    queueMicrotask(update);
    const poll = setInterval(update, 5000),
      tick = setInterval(() => setNow(Date.now()), 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      abort.abort();
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", update);
    };
  }, [refresh, revision]);
  async function command(input: PlayerCommand) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/music/player", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId: home, room, ...input }),
        signal: AbortSignal.timeout(45000),
      });
      const data = await r.json();
      if (!r.ok)
        throw Error(data.message ?? "Sonos-kommandot kunde inte utföras.");
      if (data.room !== room || !Number.isFinite(data.sampledAt))
        throw Error("Spelarstatus kunde inte verifieras.");
      setSample({ key, data });
      setNow(Date.now());
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Sonos-kommandot kunde inte bekräftas.",
      );
    } finally {
      setBusy(false);
      setSeek(null);
    }
  }
  const position =
    state?.position === null || !state
      ? null
      : Math.min(
          state.duration ?? Infinity,
          state.position +
            (state.playing && fresh ? Math.max(0, now - state.sampledAt) : 0),
        );
  const canSeek =
    !!state?.canSeek &&
    !!state.itemId &&
    state.duration !== null &&
    fresh &&
    !busy;
  return (
    <section className="mini-player" aria-label="Sonos mediaspelare">
      <div className="mini-player-track">
        <strong>{state?.title ?? "Låtinformation saknas"}</strong>
        {state?.artist && <small>{state.artist}</small>}
      </div>
      <div className="mini-player-progress">
        <span>
          {time(
            seek !== null && seek.item === state?.itemId
              ? seek.value
              : position,
          )}
        </span>
        <input
          aria-label="Spola i låten"
          type="range"
          min={0}
          max={state?.duration ?? 1}
          step={1000}
          disabled={!canSeek}
          value={
            seek !== null && seek.item === state?.itemId
              ? seek.value
              : (position ?? 0)
          }
          onChange={(e) =>
            setSeek({ item: state!.itemId!, value: Number(e.target.value) })
          }
          onPointerUp={(e) => {
            if (canSeek)
              void command({
                action: "seek",
                itemId: state!.itemId!,
                position: Number(e.currentTarget.value),
              });
          }}
          onKeyUp={(e) => {
            if (
              canSeek &&
              [
                "ArrowLeft",
                "ArrowRight",
                "Home",
                "End",
                "PageUp",
                "PageDown",
              ].includes(e.key)
            )
              void command({
                action: "seek",
                itemId: state!.itemId!,
                position: Number(e.currentTarget.value),
              });
          }}
        />
        <span>{time(state?.duration ?? null)}</span>
      </div>
      <div className="mini-player-buttons">
        <button
          aria-label="Föregående låt"
          disabled={busy || !fresh || !state?.canPrevious}
          onClick={() => void command({ action: "previous" })}
        >
          <SkipBack size={18} />
        </button>
        <button
          aria-label={state?.playing ? "Pausa musik" : "Spela musik"}
          disabled={busy || !fresh}
          onClick={() =>
            void command({ action: state?.playing ? "pause" : "play" })
          }
        >
          {state?.playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          aria-label="Nästa låt"
          disabled={busy || !fresh || !state?.canNext}
          onClick={() => void command({ action: "next" })}
        >
          <SkipForward size={18} />
        </button>
        <div className="mini-player-volume" aria-label="Volym">
          <button
            aria-label="Sänk volym"
            disabled={
              busy ||
              !fresh ||
              state?.fixedVolume ||
              state?.volume === null ||
              state?.volume === 0
            }
            onClick={() => void command({ action: "volume", delta: -5 })}
          >
            <Minus size={17} />
          </button>
          <output aria-label="Sonos-volym">
            {state?.volume === null || !state ? "—" : `${state.volume} %`}
          </output>
          <button
            aria-label="Höj volym"
            disabled={
              busy ||
              !fresh ||
              state?.fixedVolume ||
              state?.volume === null ||
              state?.volume === 100
            }
            onClick={() => void command({ action: "volume", delta: 5 })}
          >
            <Plus size={17} />
          </button>
        </div>
      </div>
      {state?.shuffle !== null && state && (
        <small>
          {state.shuffle ? "Shuffle på" : "Shuffle av"}
          {state.repeatOne ? " · Låtrepetition på" : ""}
        </small>
      )}
      {state && !state.canSeek && (
        <small>Musikkällan tillåter inte spolning.</small>
      )}
      {!fresh && state && <small>Status behöver uppdateras.</small>}
      {error && <p role="status">{error}</p>}
    </section>
  );
}
