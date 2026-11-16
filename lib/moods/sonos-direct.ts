import { randomInt } from "node:crypto";
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
const lastPlayed = new Map<string, string>();
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
  const key = `${input.householdId}/${input.room}/${input.mood}`;
  const alternatives = candidates.filter(
    (x) => `${x.kind}:${x.id}` !== lastPlayed.get(key),
  );
  const choices = alternatives.length ? alternatives : candidates;
  const chosen = choices[randomInt(choices.length)];
  const room = encodeURIComponent(input.room);
  await sonosRequest(`/groups/${room}/groupVolume`, session, "POST", {
    volume: input.style.volume,
  });
  try {
    await sonosRequest(
      `/groups/${room}/${chosen.kind === "favorite" ? "favorites" : "playlists"}`,
      session,
      "POST",
      {
        ...(chosen.kind === "favorite"
          ? { favoriteId: chosen.id }
          : { playlistId: chosen.id }),
        action: "REPLACE",
        playOnCompletion: true,
        playModes: { shuffle: true },
      },
    );
  } catch (error) {
    if (error instanceof MusicError) error.volumeApplied = true;
    throw error;
  }
  if (lastPlayed.size > 1000) lastPlayed.clear();
  lastPlayed.set(key, `${chosen.kind}:${chosen.id}`);
  let message = `Sonos tog emot startbegäran för ${chosen.name}.`;
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
    playlist: { name: chosen.name },
    music: { status: "requested", message },
    lights: {
      status: "preview",
      message: "Ljusnivån visas på husbilden. Plejd är inte anslutet.",
    },
  };
}
