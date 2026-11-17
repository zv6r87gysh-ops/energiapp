import { randomInt } from "node:crypto";
import { playbackSchema } from "./player";
import { z } from "zod";
import { cloudFetch, sonosRooms } from "./cloud";
import { MusicError, type Session } from "./oauth";
import type {
  Activation,
  MoodResult,
  SonosCatalog,
  SonosItem,
} from "./contracts";
const base = "https://api.ws.sonos.com/control/api/v1";
const itemSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(200),
  service: z.object({ name: z.string().max(200) }).optional(),
});
async function sonosRequest(
  path: string,
  session: Session,
  method = "GET",
  body?: unknown,
) {
  try {
    return await cloudFetch(`${base}${path}`, session, method, body);
  } catch (error) {
    if (error instanceof MusicError && error.code === "premium-required") {
      const specific = new MusicError("sonos-permission-denied", 403);
      specific.volumeApplied = error.volumeApplied;
      throw specific;
    }
    throw error;
  }
}
async function catalogForHome(householdId: string, session: Session) {
  const home = encodeURIComponent(householdId);
  const results = await Promise.allSettled([
    sonosRequest(`/households/${home}/favorites`, session),
    sonosRequest(`/households/${home}/playlists`, session),
  ]);
  const items: SonosItem[] = [],
    messages: string[] = [];
  let success = 0;
  for (let i = 0; i < results.length; i++) {
    const result = results[i],
      kind = i === 0 ? "favorite" : "playlist";
    if (result.status === "rejected") {
      if (result.reason instanceof MusicError && result.reason.status === 401)
        throw result.reason;
      messages.push(
        `Sonos kunde inte läsa ${i === 0 ? "favoriter" : "sparade Sonos-spellistor"}.`,
      );
      continue;
    }
    const parsed = (
      i === 0
        ? z.object({ items: z.array(itemSchema).max(70) })
        : z.object({ playlists: z.array(itemSchema).max(100) })
    ).safeParse(result.value);
    if (!parsed.success) {
      messages.push(
        `Sonos svar för ${i === 0 ? "favoriter" : "spellistor"} kunde inte verifieras.`,
      );
      continue;
    }
    success++;
    const list =
      "items" in parsed.data ? parsed.data.items : parsed.data.playlists;
    items.push(
      ...list.map((item) => ({
        id: item.id,
        kind: kind as "favorite" | "playlist",
        name: item.name,
        ...(item.service ? { service: item.service.name } : {}),
      })),
    );
  }
  if (!success) throw new MusicError("sonos-catalog-unavailable", 503);
  return {
    items: [...new Map(items.map((x) => [`${x.kind}:${x.id}`, x])).values()],
    messages,
  };
}
export async function sonosCatalog(
  room: string,
  session: Session,
): Promise<SonosCatalog> {
  const selected = (await sonosRooms(session)).find((r) => r.id === room);
  if (!selected) throw new MusicError("invalid-room", 400);
  return { room, ...(await catalogForHome(selected.householdId, session)) };
}
export async function activateSonosMood(
  input: Activation,
  session: Session,
): Promise<MoodResult> {
  // Re-read the room's actual household catalog before any volume/start command.
  const catalog = await sonosCatalog(input.room, session);
  const pool = input.style.sonosItems ?? [];
  if (!pool.length) throw new MusicError("sonos-pool-empty", 422);
  const wanted = new Set(pool.map((x) => `${x.kind}:${x.id}`));
  const candidates = catalog.items.filter((x) =>
    wanted.has(`${x.kind}:${x.id}`),
  );
  // Fail rather than silently substituting other content if a saved selection disappeared.
  if (candidates.length !== wanted.size)
    throw new MusicError("sonos-selection-missing", 409);
  // Shuffle the source order as well, but load every selected source into one queue.
  const sources = [...candidates];
  for (let i = sources.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [sources[i], sources[j]] = [sources[j], sources[i]];
  }
  const sourceName = candidates.map((x) => x.name).join(" + ");
  const room = encodeURIComponent(input.room);
  const trackIdentity = async () => {
    try {
      const raw = z
        .object({
          currentItem: z
            .object({
              track: z.object({
                name: z.string(),
                artist: z.object({ name: z.string() }).optional(),
              }),
            })
            .optional(),
        })
        .safeParse(
          await sonosRequest(`/groups/${room}/playbackMetadata`, session),
        );
      const track = raw.success ? raw.data.currentItem?.track : null;
      return track ? `${track.name}/${track.artist?.name ?? ""}` : null;
    } catch {
      return null;
    }
  };
  const previousTrack = await trackIdentity();

  await sonosRequest(`/groups/${room}/groupVolume`, session, "POST", {
    volume: input.style.volume,
  });
  try {
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      await sonosRequest(
        `/groups/${room}/${source.kind === "favorite" ? "favorites" : "playlists"}`,
        session,
        "POST",
        {
          ...(source.kind === "favorite"
            ? { favoriteId: source.id }
            : { playlistId: source.id }),
          action: i === 0 ? "REPLACE" : "APPEND",
          playOnCompletion: false,
          playModes: { shuffle: true, repeatOne: false, repeat: false },
        },
      );
      if (sources.length > 1 && source.kind === "favorite") {
        const meta = z
          .object({
            container: z.object({ type: z.string().optional() }).optional(),
          })
          .safeParse(
            await sonosRequest(`/groups/${room}/playbackMetadata`, session),
          );
        if (
          meta.success &&
          ["station", "radio", "program"].includes(
            meta.data.container?.type ?? "",
          )
        )
          throw new MusicError("sonos-mix-unavailable", 409);
      }
    }
    // Explicitly re-enable shuffle even if it was changed in another Sonos app.
    await sonosRequest(`/groups/${room}/playback/playMode`, session, "POST", {
      playModes: { shuffle: true, repeatOne: false, repeat: false },
    });
    // Only start after all favorites have been appended and shuffle has been requested.
    await sonosRequest(`/groups/${room}/playback/play`, session, "POST", {});
    // A successful mode command alone does not prove that the service applied it.
    let state = playbackSchema.parse(
      await sonosRequest(`/groups/${room}/playback`, session),
    );
    if (
      state.playModes?.shuffle !== true ||
      state.playModes?.repeatOne !== false
    )
      throw new MusicError("shuffle-unavailable", 409);
    // A single fixed skip can repeatedly start on the same second song after reload.
    const jumps = randomInt(1, 4);
    for (let i = 0; i < jumps; i++) {
      if (state.availablePlaybackActions?.canSkip === false) break;
      await sonosRequest(
        `/groups/${room}/playback/skipToNextTrack`,
        session,
        "POST",
        {},
      );
      if (i + 1 < jumps)
        state = playbackSchema.parse(
          await sonosRequest(`/groups/${room}/playback`, session),
        );
    }
    if (previousTrack && (await trackIdentity()) === previousTrack) {
      const current = playbackSchema.parse(
        await sonosRequest(`/groups/${room}/playback`, session),
      );
      if (current.availablePlaybackActions?.canSkip === true) {
        await sonosRequest(
          `/groups/${room}/playback/skipToNextTrack`,
          session,
          "POST",
          {},
        );
      }
      if ((await trackIdentity()) === previousTrack)
        throw new MusicError("same-track", 409);
    }
  } catch (error) {
    if (error instanceof MusicError) error.volumeApplied = true;
    throw error;
  }
  let message = `Sonos tog emot startbegäran för ${sourceName}.`;
  try {
    const state = z
      .object({ playbackState: z.string() })
      .safeParse(await sonosRequest(`/groups/${room}/playback`, session));
    if (state.success && state.data.playbackState === "PLAYBACK_STATE_PLAYING")
      message +=
        " Gruppen rapporterar uppspelning. Kontrollera ljudet i rätt rum.";
    else message += " Uppspelningen har ännu inte bekräftats.";
  } catch {
    message += " Uppspelningsstatus kunde inte läsas.";
  }
  return {
    mood: input.mood,
    playlist: { name: sourceName },
    music: { status: "requested", message },
    lights: {
      status: "preview",
      message: "Ljusnivån visas på husbilden. Plejd är inte anslutet.",
    },
  };
}
