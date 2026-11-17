import { afterEach, expect, it, vi } from "vitest";
import { activateSonosMood, sonosCatalog } from "../lib/moods/sonos-direct";
import { pauseMusic, setMusicVolume } from "../lib/moods/cloud";
import { defaultMoods } from "../lib/moods/contracts";
import type { Session } from "../lib/moods/oauth";
const session: Session = {
  access: "test",
  refresh: "test",
  householdId: "home",
  expires: Date.now() + 60000,
  until: Date.now() + 60000,
};
afterEach(() => vi.unstubAllGlobals());
function mock(shuffle = true, repeatOne = false) {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") return Response.json({});
    if (url.endsWith("/households"))
      return Response.json({ households: [{ id: "household" }] });
    if (url.endsWith("/groups"))
      return Response.json({ groups: [{ id: "room", name: "Allrum" }] });
    if (url.endsWith("/favorites"))
      return Response.json({
        items: [
          { id: "chill", name: "Chill" },
          { id: "lounge", name: "Lounge" },
        ],
      });
    if (url.endsWith("/playlists"))
      return Response.json({ playlists: [{ id: "kids", name: "Barn" }] });
    if (url.endsWith("/playback"))
      return Response.json({
        playbackState: "PLAYBACK_STATE_PLAYING",
        playModes: { shuffle, repeatOne, repeat: false },
        availablePlaybackActions: { canSkip: true },
      });
    throw Error("Unexpected endpoint");
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
function input() {
  return {
    householdId: "home",
    room: "room",
    mood: "lounge" as const,
    sourceMode: "sonos" as const,
    requestId: crypto.randomUUID(),
    style: {
      ...defaultMoods.styles.lounge,
      sonosItems: [
        { id: "chill", kind: "favorite" as const },
        { id: "lounge", kind: "favorite" as const },
      ],
    },
  };
}
it("starts Sonos directly without any Spotify or phone call and avoids immediate repeat", async () => {
  const fetcher = mock();
  const first = await activateSonosMood(input(), session);
  const second = await activateSonosMood(input(), session);
  expect(first.playlist.name).not.toBe(second.playlist.name);
  expect(first.playlist.url).toBeUndefined();
  expect(first.music.status).toBe("requested");
  for (const [url] of fetcher.mock.calls)
    expect(url).toMatch(/^https:\/\/api.ws.sonos.com\//);
  const starts = fetcher.mock.calls.filter(
    ([url, init]) => url.endsWith("/favorites") && init?.method === "POST",
  );
  expect(starts).toHaveLength(2);
  const modes = fetcher.mock.calls.filter(([url]) =>
    url.endsWith("/playback/playMode"),
  );
  expect(modes).toHaveLength(2);
  expect(JSON.parse(modes[0][1]!.body as string)).toMatchObject({
    playModes: { shuffle: true, repeatOne: false },
  });
  const skips = fetcher.mock.calls.filter(([url]) =>
    url.endsWith("/playback/skipToNextTrack"),
  );
  expect(skips.length).toBeGreaterThanOrEqual(2);
  expect(skips.length).toBeLessThanOrEqual(6);
  expect(JSON.parse(starts[0][1]!.body as string)).toMatchObject({
    action: "REPLACE",
    playOnCompletion: true,
    playModes: { shuffle: true },
  });
});
it("rejects stale selections before changing volume or starting music", async () => {
  const fetcher = mock();
  const data = input();
  data.style.sonosItems = [{ id: "missing", kind: "favorite" }];
  await expect(activateSonosMood(data, session)).rejects.toMatchObject({
    code: "sonos-selection-missing",
  });
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
    false,
  );
});
it("rejects an unrelated room before reading its music catalog", async () => {
  const fetcher = mock();
  await expect(sonosCatalog("other", session)).rejects.toMatchObject({
    code: "invalid-room",
  });
  expect(fetcher.mock.calls.some(([url]) => url.endsWith("/favorites"))).toBe(
    false,
  );
});

it("next track targets only the selected authorized Sonos group", async () => {
  const fetcher = mock();
  await pauseMusic("room", session, "skipToNextTrack");
  expect(
    fetcher.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([url]) => url),
  ).toEqual([
    "https://api.ws.sonos.com/control/api/v1/groups/room/playback/skipToNextTrack",
  ]);
});
it("next track rejects an unrelated group without sending commands", async () => {
  const fetcher = mock();
  await expect(
    pauseMusic("other", session, "skipToNextTrack"),
  ).rejects.toMatchObject({ code: "invalid-room" });
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
    false,
  );
});

it("volume validates the target and sends a bounded integer to Sonos", async () => {
  const fetcher = mock();
  await expect(setMusicVolume("room", session, 101)).rejects.toMatchObject({
    code: "invalid-volume",
  });
  expect(fetcher).not.toHaveBeenCalled();
  await expect(setMusicVolume("other", session, 30)).rejects.toMatchObject({
    code: "invalid-room",
  });
  await setMusicVolume("room", session, 30);
  const writes = fetcher.mock.calls.filter(
    ([, init]) => init?.method === "POST",
  );
  expect(writes).toHaveLength(1);
  expect(writes[0][0]).toBe(
    "https://api.ws.sonos.com/control/api/v1/groups/room/groupVolume",
  );
  expect(JSON.parse(writes[0][1]!.body as string)).toEqual({ volume: 30 });
});

it("refuses to claim shuffle works when Sonos still reports repeat-one or shuffle off", async () => {
  for (const modes of [
    [false, false],
    [true, true],
  ]) {
    const f = mock(...(modes as [boolean, boolean]));
    await expect(activateSonosMood(input(), session)).rejects.toMatchObject({
      code: "shuffle-unavailable",
    });
    expect(f.mock.calls.some(([url]) => url.endsWith("skipToNextTrack"))).toBe(
      false,
    );
  }
});

it("reports when Sonos keeps returning the same track despite shuffle and skipping", async () => {
  const fetcher = mock();
  const original = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (url, init) =>
    url.endsWith("/playbackMetadata")
      ? Response.json({
          currentItem: {
            track: { name: "Stuck song", artist: { name: "Artist" } },
          },
        })
      : original(url, init),
  );
  await expect(activateSonosMood(input(), session)).rejects.toMatchObject({
    code: "same-track",
  });
});
