"use client";
import Link from "next/link";
import { MusicPlayer } from "./music-player";
import { useState } from "react";
import { Music2, Sparkles, Smile, Waves } from "lucide-react";
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
  const [playerRevision, setPlayerRevision] = useState(0);
  const [result, setResult] = useState("");
  const [playlist, setPlaylist] = useState<{
    name: string;
    url?: string;
  } | null>(null);
  const direct = settings.sourceMode === "sonos";
  const connected =
    !!cloud.status?.sonos.connected &&
    (direct || !!cloud.status?.spotify.connected);
  const hasSpeaker = cloud.status?.devices.some(
    (d) => d.kind === "Speaker" && !d.restricted,
  );
  const ready =
    connected &&
    cloud.status!.rooms.some((r) => r.id === settings.room) &&
    (direct ||
      cloud.status!.devices.some(
        (d) =>
          d.id === settings.device && !d.restricted && d.kind === "Speaker",
      ));
  async function choose(mood: MoodId) {
    const style = settings.styles[mood];
    setPlaylist(null);
    setResult("");
    if (!ready || (direct && !style.sonosItems?.length)) {
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
      sourceMode: settings.sourceMode,
      device: direct ? undefined : settings.device,
      requestId: crypto.randomUUID(),
    });
    if (response) {
      onPreview(style);
      setLast(mood);
      setPlaylist(response.playlist);
      setResult("");
      setPlayerRevision((v) => v + 1);
    }
  }
  return (
    <section className="card music-moods" aria-label="Musik och stämningar">
      <div className="music-moods-heading">
        <span className="eyebrow">MUSIK FÖR STUNDEN</span>
        <Music2 size={22} />
      </div>
      <h2>Musik & stämning</h2>
      {!(ready && direct) && (
        <p className="muted">
          {ready
            ? "Tryck för en slumpvald spellista i din musikstil."
            : connected
              ? hasSpeaker
                ? "Välj Sonos-rum och tillhörande högtalare i inställningarna."
                : "Spotify visar ännu ingen styrbar högtalare. Se anslutningsstatus i inställningarna."
              : "Prova ljuset nu. Anslut musiken i inställningarna."}
        </p>
      )}
      <div className="mood-buttons">
        {moodIds.map((id) => {
          const Icon = icons[id];
          const style = settings.styles[id];
          return (
            <button
              key={id}
              className={`mood-button mood-${id}`}
              aria-label={`${ready && (!direct || style.sonosItems?.length) ? "Spela" : "Förhandsvisa"} ${moodLabels[id]}`}
              data-selected={last === id}
              disabled={cloud.busy}
              onClick={() => void choose(id)}
            >
              <Icon size={28} />
              <span>
                <b>{moodLabels[id]}</b>
                <small>
                  {direct
                    ? `${style.sonosItems?.length ?? 0} Sonos-musikval`
                    : style.query}{" "}
                  · ljus {style.brightness} %
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
          ? direct
            ? "Sonos direkt · redo att spela"
            : "Sonos + Spotify · redo att spela"
          : connected
            ? "Välj högtalare i inställningarna"
            : "Musikförhandsvisning"}
      </div>
      {cloud.busy && <p role="status">Kontaktar musiktjänsten…</p>}
      {cloud.status?.sonos.connected && settings.room && (
        <MusicPlayer
          home={home}
          room={settings.room}
          revision={playerRevision}
        />
      )}
      {result && (
        <p className="mood-result" role="status">
          {result}
        </p>
      )}
      {playlist && !playlist.url && <p>{playlist.name}</p>}
      {playlist?.url && (
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
  const direct = values.sourceMode === "sonos";
  const catalog = cloud.catalog?.room === values.room ? cloud.catalog : null;
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
        Välj Sonos direkt för att starta sparad musik utan telefon, Home
        Assistant eller Raspberry Pi. Välj flera musikval per stämning för
        slumpning. Fri genresökning i Spotify är ett separat läge.
      </p>
      {cloud.loginMessage && (
        <p className="music-login-feedback" role="status">
          {cloud.loginMessage}
        </p>
      )}
      <div className="music-account-links">
        {(["sonos", "spotify"] as const).map((provider) => (
          <div key={provider}>
            <b>{provider === "sonos" ? "Sonos" : "Spotify"}</b>
            <span>
              {cloud.status?.[provider].connected
                ? "Anslutet"
                : "Inte anslutet"}
            </span>
            {cloud.status?.[provider].message && (
              <p role="status">{cloud.status[provider].message}</p>
            )}
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
        Sonos direkt använder musiktjänsterna som redan är anslutna i Sonos.
        Lägg vid behov till favoriter eller Sonos-spellistor en gång i
        Sonos-appen på iPaden. Spotify-inloggningen ovan behövs bara för Spotify
        Connect-läget.
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
          const selected = cloud.status?.devices.find(
            (d) => d.id === values.device,
          );
          if (
            !direct &&
            selected &&
            (selected.restricted || selected.kind !== "Speaker")
          ) {
            setMessage(
              "Den valda enheten kan inte användas som Sonos-högtalare. Rensa enhetsvalet eller välj en tillgänglig högtalare.",
            );
            return;
          }
          const r = moodSettingsSchema.safeParse(values);
          if (!r.success) {
            setMessage("Kontrollera sökord, volym och ljusnivåer.");
            return;
          }
          onSave(r.data);
          setMessage("Stämningarna har sparats för hushållet.");
        }}
      >
        <label>
          Uppspelningssätt
          <select
            value={values.sourceMode ?? "spotify"}
            onChange={(e) =>
              setValues({
                ...values,
                sourceMode: e.target.value as "sonos" | "spotify",
              })
            }
          >
            <option value="spotify">Spotify Connect – genresökning</option>
            <option value="sonos">Sonos direkt – sparade musikval</option>
          </select>
        </label>
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
          {!direct && (
            <label>
              Spotify Connect-enhet för samma Sonos-rum
              <select
                value={values.device ?? ""}
                onChange={(e) =>
                  setValues({ ...values, device: e.target.value })
                }
              >
                <option value="">Välj din Sonos-högtalare</option>
                {cloud.status?.devices.map((d) => (
                  <option
                    key={d.id}
                    value={d.id}
                    disabled={d.restricted || d.kind !== "Speaker"}
                  >
                    {d.name}
                    {d.restricted
                      ? " · uppspelning begränsad"
                      : d.kind !== "Speaker"
                        ? " · inte en högtalare"
                        : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {direct && (
          <>
            <button
              type="button"
              className="button secondary"
              disabled={!values.room || !cloud.status?.sonos.connected}
              onClick={() => void cloud.loadSonosCatalog(values.room!)}
            >
              Hämta Sonos-musik
            </button>
            <p role="status">{cloud.catalogMessage}</p>
            {catalog && !catalog.items.length && (
              <p>
                Inga sparade musikval hittades i Sonos. Lägg till favoriter i
                Sonos och hämta igen.
              </p>
            )}
          </>
        )}
        {moodIds.map((id) => (
          <fieldset key={id} className={`mood-style-settings mood-${id}`}>
            <legend>{moodLabels[id]}</legend>
            {direct && (
              <div className="mood-light-selection">
                {(catalog?.items ?? []).map((item) => (
                  <label key={`${item.kind}:${item.id}`}>
                    <input
                      type="checkbox"
                      checked={
                        !!values.styles[id].sonosItems?.some(
                          (x) => x.id === item.id && x.kind === item.kind,
                        )
                      }
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          styles: {
                            ...v.styles,
                            [id]: {
                              ...v.styles[id],
                              sonosItems: e.target.checked
                                ? [
                                    ...(v.styles[id].sonosItems ?? []),
                                    { id: item.id, kind: item.kind },
                                  ]
                                : (v.styles[id].sonosItems ?? []).filter(
                                    (x) =>
                                      x.id !== item.id || x.kind !== item.kind,
                                  ),
                            },
                          },
                        }))
                      }
                    />
                    {item.name} ·{" "}
                    {item.kind === "favorite" ? "favorit" : "Sonos-spellista"}
                    {item.service ? ` · ${item.service}` : ""}
                  </label>
                ))}
                <p>
                  {values.styles[id].sonosItems?.length ?? 0} musikval. Flera
                  val blandas i samma Sonos-kö. Låtar från alla valda favoriter
                  shufflas tillsammans. Radioströmmar kan inte blandas.
                </p>
                {!!values.styles[id].sonosItems?.length && (
                  <button
                    type="button"
                    onClick={() =>
                      setValues((v) => ({
                        ...v,
                        styles: {
                          ...v.styles,
                          [id]: { ...v.styles[id], sonosItems: [] },
                        },
                      }))
                    }
                  >
                    Rensa musikval för {moodLabels[id]}
                  </button>
                )}
              </div>
            )}
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
