import { z } from "zod";
import { cloudFetch, sonosRooms } from "./cloud";
import { MusicError, type Session } from "./oauth";
const base = "https://api.ws.sonos.com/control/api/v1";
const flag = z.boolean().optional();
export const playbackSchema = z.object({
  playbackState: z.string(),
  itemId: z.string().max(128).optional(),
  positionMillis: z.number().int().nonnegative().optional(),
  playModes: z
    .object({ shuffle: flag, repeatOne: flag, repeat: flag })
    .optional(),
  availablePlaybackActions: z
    .object({
      canSkip: flag,
      canSkipBack: flag,
      canSeek: flag,
      canPause: flag,
      canShuffle: flag,
    })
    .optional(),
});
const metadataSchema = z.object({
  currentItem: z
    .object({
      id: z.string().max(128).optional(),
      track: z
        .object({
          name: z.string().max(500).optional(),
          artist: z.object({ name: z.string().max(500) }).optional(),
          durationMillis: z.number().int().positive().optional(),
        })
        .optional(),
    })
    .optional(),
});
export type PlayerState = {
  room: string;
  sampledAt: number;
  playing: boolean;
  itemId: string | null;
  title: string | null;
  artist: string | null;
  position: number | null;
  duration: number | null;
  volume: number | null;
  fixedVolume: boolean;
  shuffle: boolean | null;
  repeatOne: boolean | null;
  canNext: boolean;
  canPrevious: boolean;
  canSeek: boolean;
};
export async function checkedRoom(room: string, session: Session) {
  if (!(await sonosRooms(session)).some((r) => r.id === room))
    throw new MusicError("invalid-room", 400);
  return `${base}/groups/${encodeURIComponent(room)}`;
}
export async function playerState(
  room: string,
  session: Session,
): Promise<PlayerState> {
  const group = await checkedRoom(room, session);
  const [playback, metadata, volume] = await Promise.allSettled([
    cloudFetch(`${group}/playback`, session),
    cloudFetch(`${group}/playbackMetadata`, session),
    cloudFetch(`${group}/groupVolume`, session),
  ]);
  if (playback.status === "rejected") throw playback.reason;
  const state = playbackSchema.parse(playback.value);
  const meta =
    metadata.status === "fulfilled"
      ? metadataSchema.safeParse(metadata.value)
      : null;
  const vol =
    volume.status === "fulfilled"
      ? z
          .object({ volume: z.number().int().min(0).max(100), fixed: flag })
          .safeParse(volume.value)
      : null;
  const item = meta?.success ? meta.data.currentItem : null;
  return {
    room,
    sampledAt: Date.now(),
    playing: state.playbackState === "PLAYBACK_STATE_PLAYING",
    itemId: state.itemId ?? item?.id ?? null,
    title: item?.track?.name ?? null,
    artist: item?.track?.artist?.name ?? null,
    position: state.positionMillis ?? null,
    duration: item?.track?.durationMillis ?? null,
    volume: vol?.success ? vol.data.volume : null,
    fixedVolume: vol?.success ? !!vol.data.fixed : true,
    shuffle: state.playModes?.shuffle ?? null,
    repeatOne: state.playModes?.repeatOne ?? null,
    canNext: state.availablePlaybackActions?.canSkip === true,
    canPrevious: state.availablePlaybackActions?.canSkipBack === true,
    canSeek: state.availablePlaybackActions?.canSeek === true,
  };
}
export const playerCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["next", "previous", "pause", "play"]) }),
  z.object({
    action: z.literal("volume"),
    delta: z.union([z.literal(-5), z.literal(5)]),
  }),
  z.object({
    action: z.literal("seek"),
    position: z.number().int().nonnegative().max(2147483647),
    itemId: z.string().min(1).max(128),
  }),
]);
export type PlayerCommand = z.infer<typeof playerCommandSchema>;
export async function playerCommand(
  room: string,
  session: Session,
  command: PlayerCommand,
) {
  const state = await playerState(room, session);
  const group = `${base}/groups/${encodeURIComponent(room)}`;
  if (command.action === "seek") {
    if (
      !state.canSeek ||
      state.itemId !== command.itemId ||
      state.duration === null ||
      command.position > state.duration
    )
      throw new MusicError("player-action-unavailable", 409);
    await cloudFetch(`${group}/playback/seek`, session, "POST", {
      itemId: command.itemId,
      positionMillis: command.position,
    });
  } else if (command.action === "volume") {
    if (state.fixedVolume || state.volume === null)
      throw new MusicError("player-action-unavailable", 409);
    await cloudFetch(`${group}/groupVolume/relative`, session, "POST", {
      volumeDelta: command.delta,
    });
  } else {
    if (
      (command.action === "next" && !state.canNext) ||
      (command.action === "previous" && !state.canPrevious)
    )
      throw new MusicError("player-action-unavailable", 409);
    const action = {
      next: "skipToNextTrack",
      previous: "skipToPreviousTrack",
      pause: "pause",
      play: "play",
    }[command.action];
    await cloudFetch(`${group}/playback/${action}`, session, "POST", {});
  }
  return playerState(room, session);
}
