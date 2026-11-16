import { randomInt } from "node:crypto";
import { z } from "zod";
import { MusicError, type Session } from "./oauth";
import type { Activation, MoodResult } from "./contracts";
const sonosBase = "https://api.ws.sonos.com/control/api/v1";
const spotifyBase = "https://api.spotify.com/v1";
export async function cloudFetch(
  url: string,
  session: Session,
  method = "GET",
  body?: unknown,
  timeout = 10000,
) {
  let r: Response;
  try {
    r = await fetch(url, {
      method,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeout),
      headers: {
        Authorization: `Bearer ${session.access}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new MusicError("provider-unavailable");
  }
  if (r.status === 401) throw new MusicError("login-required", 401);
  if (r.status === 403) throw new MusicError("premium-required", 403);
  if (r.status === 429) throw new MusicError("rate-limited", 429);
  if (r.status === 404) throw new MusicError("device-unavailable", 409);
  if (!r.ok) throw new MusicError("provider-unavailable");
  if (r.status === 204) return null;
  const text = await r.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new MusicError("invalid-provider-response");
  }
}
export async function sonosRooms(session: Session) {
  const homes = z
    .object({ households: z.array(z.object({ id: z.string() })).max(20) })
    .safeParse(await cloudFetch(`${sonosBase}/households`, session));
  if (!homes.success) throw new MusicError("invalid-provider-response");
  const rooms: { id: string; name: string; householdId: string }[] = [];
  for (const home of homes.data.households) {
    const groups = z
      .object({
        groups: z
          .array(z.object({ id: z.string(), name: z.string() }))
          .max(100),
      })
      .safeParse(
        await cloudFetch(
          `${sonosBase}/households/${encodeURIComponent(home.id)}/groups`,
          session,
        ),
      );
    if (!groups.success) throw new MusicError("invalid-provider-response");
    rooms.push(
      ...groups.data.groups.map((group) => ({
        ...group,
        householdId: home.id,
      })),
    );
  }
  return rooms;
}
const spotifyDeviceSchema = z.object({
  id: z.string().nullable(),
  name: z.string().min(1).max(200),
  is_restricted: z.boolean(),
  type: z.string().optional(),
});
export async function spotifyDeviceSnapshot(session: Session) {
  const data = z
    .object({ devices: z.array(spotifyDeviceSchema).max(100) })
    .safeParse(await cloudFetch(`${spotifyBase}/me/player/devices`, session));
  if (!data.success) throw new MusicError("invalid-provider-response");
  const devices = data.data.devices.flatMap((d) =>
    d.id
      ? [
          {
            id: d.id,
            name: d.name,
            restricted: d.is_restricted,
            kind: d.type ?? "Unknown",
          },
        ]
      : [],
  );
  const unnamedIds = data.data.devices
    .filter((d) => !d.id)
    .slice(0, 3)
    .map((d) => d.name);
  let message: string | undefined = unnamedIds.length
    ? `Spotify visar ${unnamedIds.join(", ")} utan styrbart enhets-ID.`
    : undefined;
  try {
    const raw = await cloudFetch(
      `${spotifyBase}/me/player`,
      session,
      "GET",
      undefined,
      4000,
    );
    const playback = z
      .object({ device: spotifyDeviceSchema, is_playing: z.boolean() })
      .safeParse(raw);
    if (raw === null)
      message ??=
        "Spotify rapporterar ingen aktiv uppspelning för detta konto.";
    if (playback.success) {
      const current = playback.data.device;
      if (!current.id)
        message = `Spotify rapporterar ${current.name} utan styrbart enhets-ID. Den går inte att välja via Spotify API.`;
      else {
        const existing = devices.find((d) => d.id === current.id);
        if (!existing)
          devices.push({
            id: current.id,
            name: current.name,
            restricted: current.is_restricted,
            kind: current.type ?? "Unknown",
          });
        else {
          existing.restricted ||= current.is_restricted;
          if (existing.kind === "Unknown" && current.type)
            existing.kind = current.type;
        }
        message = `Spotify rapporterar ${playback.data.is_playing ? "aktiv" : "senaste"} uppspelningsenhet: ${current.name}.`;
        if (current.is_restricted)
          message += " Spotify tillåter inte API-styrning av denna enhet.";
        else if (current.type === "Smartphone")
          message +=
            " Om ljudet går till Sonos via AirPlay är telefonen fortfarande Spotify-enheten. För direktstyrning av Sonos behöver högtalaren visas som en egen Spotify Connect-enhet.";
      }
    } else
      message ??=
        "Spotify kunde inte verifiera vilken uppspelningsenhet som är aktiv.";
  } catch (error) {
    // A supplementary state lookup must not erase a usable device list.
    // An actually revoked token is still an authentication failure.
    if (error instanceof MusicError && error.status === 401) throw error;
    message ??=
      "Spotify-listan hämtades, men den aktiva uppspelningsenheten kunde inte läsas.";
  }
  return { devices, message };
}
export async function spotifyDevices(session: Session) {
  return (await spotifyDeviceSnapshot(session)).devices;
}
const playlistSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9]+$/),
    name: z.string().min(1),
    uri: z.string().regex(/^spotify:playlist:[a-zA-Z0-9]+$/),
  })
  .refine((p) => p.uri === `spotify:playlist:${p.id}`);
export async function findPlaylist(
  session: Session,
  query: string,
  previous?: string,
) {
  const url = new URL(`${spotifyBase}/search`);
  url.search = new URLSearchParams({
    q: query,
    type: "playlist",
    limit: "10",
  }).toString();
  const response = z
    .object({ playlists: z.object({ items: z.array(z.unknown()).max(100) }) })
    .safeParse(await cloudFetch(url.toString(), session));
  if (!response.success) throw new MusicError("invalid-provider-response");
  const all = response.data.playlists.items.flatMap((p) => {
    const r = playlistSchema.safeParse(p);
    return r.success ? [r.data] : [];
  });
  const unique = [...new Map(all.map((p) => [p.uri, p])).values()];
  if (!unique.length) throw new MusicError("no-playlists", 422);
  const alternatives = unique.filter((p) => p.uri !== previous);
  const candidates = alternatives.length ? alternatives : unique;
  return candidates[randomInt(candidates.length)];
}
// Only a short-lived anti-repeat hint. Every activation still searches the provider.
const recent = new Map<string, string>();
export async function activateMood(
  input: Activation,
  sonos: Session,
  spotify: Session,
): Promise<MoodResult> {
  const rooms = await sonosRooms(sonos),
    devices = await spotifyDevices(spotify);
  if (!rooms.some((r) => r.id === input.room))
    throw new MusicError("invalid-room", 400);
  const selected = devices.find((d) => d.id === input.device);
  if (!selected || selected.restricted)
    throw new MusicError("device-unavailable", 409);
  if (selected.kind !== "Speaker")
    throw new MusicError("device-not-speaker", 400);
  const key = `${input.householdId}/${input.room}/${input.mood}/${input.style.query}`;
  const playlist = await findPlaylist(
    spotify,
    input.style.query,
    recent.get(key),
  );
  // Set level before starting playback. Nothing else is touched if search/selection fails.
  await cloudFetch(
    `${sonosBase}/groups/${encodeURIComponent(input.room)}/groupVolume`,
    sonos,
    "POST",
    { volume: input.style.volume },
  );
  try {
    await cloudFetch(
      `${spotifyBase}/me/player/play?${new URLSearchParams({ device_id: selected.id })}`,
      spotify,
      "PUT",
      { context_uri: playlist.uri },
    );
  } catch (error) {
    if (error instanceof MusicError) error.volumeApplied = true;
    throw error;
  }
  if (recent.size > 1000) recent.clear();
  recent.set(key, playlist.uri);
  // Read-back is observational: 'playing' does not prove that every requested track is audible.
  let playing = false;
  try {
    const state = await cloudFetch(`${spotifyBase}/me/player`, spotify);
    const parsed = z
      .object({
        is_playing: z.boolean(),
        device: z.object({ id: z.string() }),
        context: z.object({ uri: z.string() }).nullable(),
      })
      .safeParse(state);
    playing =
      parsed.success &&
      parsed.data.is_playing &&
      parsed.data.device.id === input.device &&
      parsed.data.context?.uri === playlist.uri;
  } catch {
    /* Successful command remains 'requested', never fabricated confirmation. */
  }
  return {
    mood: input.mood,
    playlist: {
      name: playlist.name,
      url: `https://open.spotify.com/playlist/${playlist.id}`,
    },
    music: {
      status: playing ? "playing" : "requested",
      message: playing
        ? "Spotify rapporterar uppspelning av vald spellista på vald enhet."
        : "Start begärd. Uppspelningen har ännu inte bekräftats.",
    },
    lights: {
      status: "preview",
      message: "Ljusnivån visas på husbilden. Plejd är inte anslutet.",
    },
  };
}
export async function pauseMusic(
  room: string,
  sonos: Session,
  action: "pause" | "skipToNextTrack" = "pause",
) {
  if (!(await sonosRooms(sonos)).some((r) => r.id === room))
    throw new MusicError("invalid-room", 400);
  await cloudFetch(
    `${sonosBase}/groups/${encodeURIComponent(room)}/playback/${action}`,
    sonos,
    "POST",
    {},
  );
}
