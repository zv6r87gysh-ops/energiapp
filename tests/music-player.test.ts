import { afterEach, expect, it, vi } from "vitest";
import { playerState, playerCommand } from "../lib/moods/player";
import type { Session } from "../lib/moods/oauth";
const session: Session = {
  access: "test",
  refresh: "test",
  expires: Date.now() + 60000,
  until: Date.now() + 60000,
  householdId: "home",
};
afterEach(() => vi.unstubAllGlobals());
function mock(canSeek = true) {
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") return Response.json({});
    if (url.endsWith("/households"))
      return Response.json({ households: [{ id: "h" }] });
    if (url.endsWith("/groups"))
      return Response.json({ groups: [{ id: "room", name: "Allrum" }] });
    if (url.endsWith("/playback"))
      return Response.json({
        playbackState: "PLAYBACK_STATE_PLAYING",
        itemId: "current",
        positionMillis: 60000,
        playModes: { shuffle: true, repeatOne: false },
        availablePlaybackActions: { canSkip: true, canSkipBack: true, canSeek },
      });
    if (url.endsWith("/playbackMetadata"))
      return Response.json({
        currentItem: {
          id: "current",
          track: {
            name: "Real title",
            artist: { name: "Artist" },
            durationMillis: 180000,
          },
        },
      });
    if (url.endsWith("/groupVolume"))
      return Response.json({ volume: 35, fixed: false });
    throw Error("Unexpected endpoint");
  });
  vi.stubGlobal("fetch", f);
  return f;
}
it("reads title, actual position, duration, playback modes and actual group volume", async () => {
  mock();
  expect(await playerState("room", session)).toMatchObject({
    title: "Real title",
    artist: "Artist",
    position: 60000,
    duration: 180000,
    volume: 35,
    shuffle: true,
    repeatOne: false,
  });
});
it("guards seeking against changed tracks and provider restrictions", async () => {
  const f = mock();
  await expect(
    playerCommand("room", session, {
      action: "seek",
      itemId: "old",
      position: 30000,
    }),
  ).rejects.toMatchObject({ code: "player-action-unavailable" });
  await expect(
    playerCommand("room", session, {
      action: "seek",
      itemId: "current",
      position: 190000,
    }),
  ).rejects.toMatchObject({ code: "player-action-unavailable" });
  expect(f.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  mock(false);
  await expect(
    playerCommand("room", session, {
      action: "seek",
      itemId: "current",
      position: 30000,
    }),
  ).rejects.toMatchObject({ code: "player-action-unavailable" });
});
it("uses provider-relative volume so another controller cannot cause a sudden volume jump", async () => {
  const f = mock();
  await playerCommand("room", session, { action: "volume", delta: -5 });
  const call = f.mock.calls.find(([url]) => url.endsWith("/relative"))!;
  expect(JSON.parse(call[1]!.body as string)).toEqual({ volumeDelta: -5 });
});
it("previous, next and seek use the selected authorized group", async () => {
  const f = mock();
  await playerCommand("room", session, { action: "previous" });
  await playerCommand("room", session, { action: "next" });
  await playerCommand("room", session, {
    action: "seek",
    itemId: "current",
    position: 30000,
  });
  const writes = f.mock.calls.filter(([, init]) => init?.method === "POST");
  expect(writes.map(([url]) => url.split("/playback/")[1])).toEqual([
    "skipToPreviousTrack",
    "skipToNextTrack",
    "seek",
  ]);
  expect(JSON.parse(writes[2][1]!.body as string)).toEqual({
    itemId: "current",
    positionMillis: 30000,
  });
});
