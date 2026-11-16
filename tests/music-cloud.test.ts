import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { activateMood, findPlaylist } from "../lib/moods/cloud";
import { defaultMoods, readMoods } from "../lib/moods/contracts";
import {
  cookieName,
  getSession,
  oauthConfig,
  seal,
  unseal,
  type Session,
} from "../lib/moods/oauth";
import { GET as connect } from "../app/api/music/connect/route";
import { GET as callback } from "../app/api/music/callback/route";
import { POST as activate } from "../app/api/music/route";
const origin = "https://energihem.example";
const secret = "test-only-session-encryption-secret-123456789";
const session: Session = {
  access: "test-access",
  refresh: "test-refresh",
  householdId: "demo-home",
  expires: Date.now() + 3600000,
  until: Date.now() + 86400000,
};
beforeEach(() => {
  vi.stubEnv("MUSIC_PUBLIC_ORIGIN", origin);
  vi.stubEnv("MUSIC_SESSION_SECRET", secret);
  for (const p of ["SONOS", "SPOTIFY"]) {
    vi.stubEnv(`${p}_CLIENT_ID`, "test-id");
    vi.stubEnv(`${p}_CLIENT_SECRET`, "test-secret");
  }
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const playlist = (id: string) => ({
  id,
  name: `List ${id}`,
  uri: `spotify:playlist:${id}`,
});
function cookies() {
  return `energihem_sonos=${seal(session, secret)}; energihem_spotify=${seal(session, secret)}`;
}
const input = () => ({
  householdId: "demo-home",
  mood: "lounge" as const,
  style: defaultMoods.styles.lounge,
  room: "room1",
  device: "device1",
  requestId: crypto.randomUUID(),
});
it("encrypts tokens and rejects changed, expired and wrong-key sessions", () => {
  const encrypted = seal(session, secret);
  expect(encrypted).not.toContain(session.refresh);
  expect(unseal(encrypted, secret)).toEqual(session);
  expect(() => unseal(encrypted, "wrong key")).toThrow();
  expect(
    getSession(
      new Request(origin, {
        headers: {
          cookie: `energihem_sonos=${seal({ ...session, until: 0 }, secret)}`,
        },
      }),
      "sonos",
    ),
  ).toBeNull();
  const changed =
    encrypted.slice(0, 20) +
    (encrypted[20] === "a" ? "b" : "a") +
    encrypted.slice(21);
  expect(() => unseal(changed, secret)).toThrow();
});
it("does not configure an integration with missing keys or an insecure remote origin", () => {
  vi.stubEnv("SONOS_CLIENT_SECRET", "");
  expect(oauthConfig("sonos")).toBeNull();
  vi.stubEnv("SONOS_CLIENT_SECRET", "secret");
  vi.stubEnv("MUSIC_PUBLIC_ORIGIN", "http://public.example");
  expect(oauthConfig("sonos")).toBeNull();
});
it("uses provider login redirects and Spotify PKCE, bound to household and short-lived state", async () => {
  const r = await connect(
    new Request(
      `${origin}/api/music/connect?provider=spotify&householdId=demo-home`,
    ),
  );
  expect(r.status).toBe(303);
  const url = new URL(r.headers.get("location")!);
  expect(url.origin).toBe("https://accounts.spotify.com");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("state")).toHaveLength(43);
  expect(r.headers.get("set-cookie")).toContain("HttpOnly");
  expect(r.headers.get("set-cookie")).toContain("Secure");
  expect(r.headers.get("set-cookie")).not.toContain("test-secret");
});
it("rejects OAuth callbacks with wrong state before making any token request", async () => {
  const f = vi.fn();
  vi.stubGlobal("fetch", f);
  const state = seal(
    {
      state: "expected",
      verifier: "test-verifier",
      householdId: "demo-home",
      until: Date.now() + 10000,
    },
    secret,
  );
  const r = await callback(
    new Request(
      `${origin}/api/music/callback?provider=sonos&code=test&state=wrong`,
      { headers: { cookie: `${cookieName("sonos", true)}=${state}` } },
    ),
  );
  expect(r.headers.get("location")).toContain("login-failed");
  expect(f).not.toHaveBeenCalled();
});
it("exchanges a valid OAuth code server-side and stores only an encrypted browser cookie", async () => {
  const f = vi.fn().mockResolvedValue(
    Response.json({
      access_token: "new-access",
      refresh_token: "new-refresh",
      expires_in: 3600,
    }),
  );
  vi.stubGlobal("fetch", f);
  const state = seal(
    {
      state: "expected",
      verifier: "test-verifier",
      householdId: "demo-home",
      until: Date.now() + 10000,
    },
    secret,
  );
  const r = await callback(
    new Request(
      `${origin}/api/music/callback?provider=spotify&code=test&state=expected`,
      { headers: { cookie: `${cookieName("spotify", true)}=${state}` } },
    ),
  );
  expect(r.headers.get("location")).toContain("music=connected");
  expect(String(f.mock.calls[0][1].body)).toContain(
    "code_verifier=test-verifier",
  );
  const cookie = r.headers.get("set-cookie")!;
  expect(cookie).not.toContain("new-access");
  expect(cookie).not.toContain("new-refresh");
});
it("rejects unauthenticated, cross-origin and other-household control without contacting devices", async () => {
  const f = vi.fn();
  vi.stubGlobal("fetch", f);
  for (const [headers, home, status] of [
    [{ origin }, "demo-home", 401],
    [{ origin: "https://other.example", cookie: cookies() }, "demo-home", 403],
    [{ origin, cookie: cookies() }, "other-home", 401],
  ] as const) {
    const r = await activate(
      new Request(`${origin}/api/music`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ...input(), householdId: home }),
      }),
    );
    expect(r.status).toBe(status);
  }
  expect(f).not.toHaveBeenCalled();
});
it("selects from fresh genre search results and avoids the previous playlist if possible", async () => {
  const f = vi.fn().mockImplementation(() =>
    Promise.resolve(
      Response.json({
        playlists: {
          items: [
            null,
            playlist("a"),
            playlist("b"),
            { ...playlist("bad"), uri: "https://evil.example" },
          ],
        },
      }),
    ),
  );
  vi.stubGlobal("fetch", f);
  expect(
    (await findPlaylist(session, "lounge chill", "spotify:playlist:a")).id,
  ).toBe("b");
  expect(new URL(f.mock.calls[0][0]).searchParams.get("q")).toBe(
    "lounge chill",
  );
  expect(new URL(f.mock.calls[0][0]).searchParams.get("type")).toBe("playlist");
});
function mockCloud(device = true, playlists = true, readback = true) {
  const f = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/households"))
      return Response.json({ households: [{ id: "h1" }] });
    if (url.endsWith("/groups"))
      return Response.json({ groups: [{ id: "room1", name: "Vardagsrum" }] });
    if (url.endsWith("/devices"))
      return Response.json({
        devices: device
          ? [{ id: "device1", name: "Vardagsrum", is_restricted: false }]
          : [],
      });
    if (url.includes("/search?"))
      return Response.json({
        playlists: { items: playlists ? [playlist("chosen")] : [] },
      });
    if (url.endsWith("/me/player"))
      return readback
        ? Response.json({
            is_playing: true,
            device: { id: "device1" },
            context: { uri: "spotify:playlist:chosen" },
          })
        : new Response(null, { status: 503 });
    if (options?.method === "PUT" || options?.method === "POST")
      return new Response(null, { status: 204 });
    throw Error("Unexpected request");
  });
  vi.stubGlobal("fetch", f);
  return f;
}
it("starts the random playlist on the selected Connect device, sets Sonos volume and reports light preview separately", async () => {
  const f = mockCloud();
  const result = await activateMood(input(), session, session);
  expect(result.music.status).toBe("playing");
  expect(result.lights.status).toBe("preview");
  expect(result.playlist.url).toBe("https://open.spotify.com/playlist/chosen");
  const put = f.mock.calls.find(([, o]) => o?.method === "PUT")!;
  expect(put[0]).toContain("device_id=device1");
  expect(JSON.parse(put[1]!.body as string)).toEqual({
    context_uri: "spotify:playlist:chosen",
  });
  expect(
    f.mock.calls.some(
      ([url, o]) =>
        url.endsWith("/groupVolume") &&
        o?.body === JSON.stringify({ volume: 18 }),
    ),
  ).toBe(true);
});
it("does not alter volume or lights when no device or no playlist can be found", async () => {
  for (const [device, playlists, code] of [
    [false, true, "device-unavailable"],
    [true, false, "no-playlists"],
  ] as const) {
    const f = mockCloud(device, playlists);
    await expect(activateMood(input(), session, session)).rejects.toMatchObject(
      { code },
    );
    expect(
      f.mock.calls.every(([, o]) => !o?.method || o.method === "GET"),
    ).toBe(true);
  }
});
it("reports requested rather than playing if provider read-back cannot confirm the playlist", async () => {
  mockCloud(true, true, false);
  expect((await activateMood(input(), session, session)).music.status).toBe(
    "requested",
  );
});
it("keeps presets per household and rejects corrupt style settings", () => {
  const first = readMoods(null),
    second = readMoods(null);
  first.styles.children.volume = 90;
  expect(second.styles.children.volume).toBe(25);
  expect(readMoods({ styles: {} })).toEqual(defaultMoods);
  expect(defaultMoods.styles.lounge.query).toContain("chill");
});

it("reports that Sonos volume already changed when Spotify rejects the following playback request", async () => {
  const f = mockCloud();
  const impl = f.getMockImplementation()!;
  f.mockImplementation((url, options) =>
    options?.method === "PUT"
      ? Promise.resolve(new Response(null, { status: 403 }))
      : impl(url, options),
  );
  const r = await activate(
    new Request(`${origin}/api/music`, {
      method: "POST",
      headers: {
        origin,
        cookie: cookies(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input()),
    }),
  );
  expect(r.status).toBe(403);
  expect((await r.json()).message).toContain("Sonos-volymen har redan ändrats");
});
