import { afterEach, expect, it, vi } from "vitest";
import { activateSonosMood, sonosCatalog } from "../lib/moods/sonos-direct";
import { pauseMusic } from "../lib/moods/cloud";
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
function mock() {
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
      return Response.json({ playbackState: "PLAYBACK_STATE_PLAYING" });
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
  expect(JSON.parse(starts[0][1]!.body as string)).toMatchObject({
    action: "REPLACE",
    playOnCompletion: true,
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
