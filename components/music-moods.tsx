"use client";
import Link from "next/link";
import { useState } from "react";
import { Music2, Pause, Sparkles, Smile, Waves } from "lucide-react";
import {
  moodIds,
  moodLabels,
  moodSettingsSchema,
  type MoodId,
  type MoodSettings,
  type MoodStyle,
} from "@/lib/moods/contracts";
import type { MusicController } from "@/lib/moods/use-music";
import { indoorGroups } from "@/lib/lighting/indoor";
const icons = { children: Smile, lounge: Waves, ambience: Sparkles };
export function MusicMoods({
  home,
  settings,
  cloud,
  onPreview,
}: {
  home: string;
  settings: MoodSettings;
  cloud: MusicController;
  onPreview: (style: MoodStyle) => void;
}) {
  const [last, setLast] = useState<MoodId | null>(null);
  const [result, setResult] = useState("");
  const [playlist, setPlaylist] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const connected =
    !!cloud.status?.sonos.connected && !!cloud.status?.spotify.connected;
  const ready =
    connected &&
    cloud.status!.rooms.some((r) => r.id === settings.room) &&
    cloud.status!.devices.some(
      (d) => d.id === settings.device && !d.restricted,
    );
  async function choose(mood: MoodId) {
    const style = settings.styles[mood];
    setPlaylist(null);
    setResult("");
    if (!ready) {
      onPreview(style);
      setLast(mood);
      setResult(
        `Förhandsvisning: ${moodLabels[mood]} · ljus ${style.brightness} %. Ingen musik startades.`,
      );
      return;
    }
    const response = await cloud.activate({
      householdId: home,
      mood,
      style,
      room: settings.room!,
      device: settings.device!,
      requestId: crypto.randomUUID(),
    });
    if (response) {
      onPreview(style);
      setLast(mood);
      setPlaylist(response.playlist);
      setResult(`${response.music.message} ${response.lights.message}`);
    }
  }
  return (
    <section className="card music-moods" aria-label="Musik och stämningar">
      <div className="music-moods-heading">
        <span className="eyebrow">MUSIK FÖR STUNDEN</span>
        <Music2 size={22} />
      </div>
      <h2>Vilken känsla idag?</h2>
      <p className="muted">
        {ready
          ? "Tryck för en slumpvald spellista i din musikstil."
          : "Prova ljuset nu. Anslut musiken i inställningarna."}
      </p>
      <div className="mood-buttons">
        {moodIds.map((id) => {
          const Icon = icons[id];
          const style = settings.styles[id];
          return (
            <button
              key={id}
              className={`mood-button mood-${id}`}
              aria-label={`${ready ? "Spela" : "Förhandsvisa"} ${moodLabels[id]}`}
              data-selected={last === id}
              disabled={cloud.busy}
              onClick={() => void choose(id)}
            >
              <Icon size={28} />
              <span>
                <b>{moodLabels[id]}</b>
                <small>
                  {style.query} · ljus {style.brightness} %
                </small>
              </span>
              <Music2 size={20} />
            </button>
          );
        })}
      </div>
      <div className="music-connection-status">
        <span className={`status-dot ${ready ? "" : "is-preview"}`} />
        {ready
          ? "Sonos + Spotify · redo att spela"
          : connected
            ? "Välj högtalare i inställningarna"
            : "Musikförhandsvisning"}
      </div>
      {cloud.busy && <p role="status">Kontaktar musiktjänsten…</p>}
      {result && (
        <p className="mood-result" role="status">
          {result}
        </p>
      )}
      {playlist && (
        <a
          className="text-link"
          href={playlist.url}
          target="_blank"
          rel="noreferrer"
        >
          {playlist.name} · öppna i Spotify ↗
        </a>
      )}
      {cloud.message && (
        <p role="status" className="mood-result">
          {cloud.message}
        </p>
      )}
      <div className="music-mood-actions">
        {cloud.status?.sonos.connected && settings.room && (
          <button
            className="button secondary"
            disabled={cloud.busy}
            onClick={() => void cloud.pause(settings.room!)}
          >
            <Pause size={17} />
            Pausa musik
          </button>
        )}
        <Link href="/installningar#music-settings" className="text-link">
          Musik & ljusinställningar →
        </Link>
      </div>
      <small className="mood-light-note">
        Ljusnivåerna är en förhandsvisning tills Plejd är anslutet.
      </small>
    </section>
  );
}
export function MoodSettingsForm({
  home,
  settings,
  cloud,
  onSave,
}: {
  home: string;
  settings: MoodSettings;
  cloud: MusicController;
  onSave: (settings: MoodSettings) => void;
}) {
  const [values, setValues] = useState(() => structuredClone(settings));
  const [message, setMessage] = useState("");
  function patch(
    id: MoodId,
    key: "query" | "volume" | "brightness",
    value: string | number,
  ) {
    setValues((v) => ({
      ...v,
      styles: { ...v.styles, [id]: { ...v.styles[id], [key]: value } },
    }));
  }
  return (
    <section className="card mood-settings" id="music-settings">
      <h2>Musik & stämningar</h2>
      <p>
        Anslut Sonos och Spotify genom att logga in hos respektive tjänst. Musik
        spelas via Spotify Connect på vald Sonos-enhet. Ingen Home Assistant
        eller Raspberry Pi behövs för musikfunktionen.
      </p>
      <div className="music-account-links">
        {(["sonos", "spotify"] as const).map((provider) => (
          <div key={provider}>
            <b>{provider === "sonos" ? "Sonos" : "Spotify"}</b>
            <span>
              {cloud.status?.[provider].connected
                ? "Anslutet"
                : "Inte anslutet"}
            </span>
            {cloud.status?.[provider].configured ? (
              <a
                className="button secondary"
                href={`/api/music/connect?${new URLSearchParams({ provider, householdId: home })}`}
              >
                {cloud.status[provider].connected
                  ? "Anslut igen"
                  : `Logga in på ${provider === "sonos" ? "Sonos" : "Spotify"}`}
              </a>
            ) : (
              <span className="muted">
                Inloggning aktiveras när tjänstens appnycklar har lagts in på
                servern.
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="muted">
        Spotify Premium och tillåtelse för Energihems utvecklarapp behövs för
        uppspelning. Om din Sonos inte syns i Spotify Connect: öppna Spotify,
        välj Sonos som uppspelningsenhet och tryck sedan Uppdatera högtalare
        här. Genrevalet söker bland spellistor; tjänsten garanterar inte genre
        för varje låt.
      </p>
      <div className="music-mood-actions">
        <button
          className="button secondary"
          type="button"
          disabled={cloud.busy}
          onClick={() => void cloud.refresh()}
        >
          Uppdatera högtalare
        </button>
        {(cloud.status?.sonos.connected || cloud.status?.spotify.connected) && (
          <button
            className="button secondary"
            disabled={cloud.busy}
            type="button"
            onClick={() => void cloud.disconnect()}
          >
            Koppla från musik
          </button>
        )}
      </div>
      {cloud.message && <p role="status">{cloud.message}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const r = moodSettingsSchema.safeParse(values);
          if (!r.success) {
            setMessage("Kontrollera sökord, volym och ljusnivåer.");
            return;
          }
          onSave(r.data);
          setMessage("Stämningarna har sparats för hushållet.");
        }}
      >
        <div className="form-grid">
          <label>
            Sonos-rum
            <select
              value={values.room ?? ""}
              onChange={(e) => setValues({ ...values, room: e.target.value })}
            >
              <option value="">Välj rum efter inloggning</option>
              {cloud.status?.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Spotify Connect-enhet för samma Sonos-rum
            <select
              value={values.device ?? ""}
              onChange={(e) => setValues({ ...values, device: e.target.value })}
            >
              <option value="">Välj din Sonos-högtalare</option>
              {cloud.status?.devices.map((d) => (
                <option key={d.id} value={d.id} disabled={d.restricted}>
                  {d.name}
                  {d.restricted ? " · uppspelning begränsad" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        {moodIds.map((id) => (
          <fieldset key={id} className={`mood-style-settings mood-${id}`}>
            <legend>{moodLabels[id]}</legend>
            <div className="form-grid">
              <label>
                Musikstil / sökord för {moodLabels[id]}
                <input
                  minLength={2}
                  maxLength={100}
                  required
                  value={values.styles[id].query}
                  onChange={(e) => patch(id, "query", e.target.value)}
                />
              </label>
              <label>
                Volym för {moodLabels[id]} (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={values.styles[id].volume}
                  onChange={(e) =>
                    patch(
                      id,
                      "volume",
                      e.target.value === "" ? NaN : Number(e.target.value),
                    )
                  }
                />
              </label>
              <label>
                Ljus för {moodLabels[id]} (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={values.styles[id].brightness}
                  onChange={(e) =>
                    patch(
                      id,
                      "brightness",
                      e.target.value === "" ? NaN : Number(e.target.value),
                    )
                  }
                />
              </label>
            </div>
            <div className="mood-light-selection">
              {indoorGroups.map((g) => (
                <label key={g.id}>
                  <input
                    type="checkbox"
                    checked={values.styles[id].lights.includes(g.id)}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        styles: {
                          ...v.styles,
                          [id]: {
                            ...v.styles[id],
                            lights: e.target.checked
                              ? [...v.styles[id].lights, g.id]
                              : v.styles[id].lights.filter((x) => x !== g.id),
                          },
                        },
                      }))
                    }
                  />
                  {g.name}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button type="submit" className="button">
          Spara stämningar
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
