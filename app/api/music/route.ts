import { z } from "zod";
import { activateSonosMood } from "../../../lib/moods/sonos-direct";
import {
  activationSchema,
  type CloudStatus,
} from "../../../lib/moods/contracts";
import {
  authorizedSession,
  cookie,
  cookieName,
  getSession,
  MusicError,
  musicMessage,
  oauthConfig,
  sameOrigin,
} from "../../../lib/moods/oauth";
import {
  activateMood,
  pauseMusic,
  setMusicVolume,
  sonosRooms,
  spotifyDeviceSnapshot,
} from "../../../lib/moods/cloud";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
const homeSchema = z.string().min(1).max(100);
const running = new Set<string>();
function responseError(error: unknown, headers: Headers) {
  const e =
    error instanceof MusicError
      ? error
      : new MusicError("invalid-provider-response");
  return Response.json(
    {
      code: e.code,
      message:
        musicMessage(e.code) +
        (e.volumeApplied ? " Sonos-volymen har redan ändrats." : ""),
    },
    { status: e.status, headers },
  );
}
export async function GET(request: Request) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  const home = homeSchema.safeParse(
    new URL(request.url).searchParams.get("householdId"),
  );
  if (!home.success)
    return Response.json(
      { message: "Ogiltigt hushåll." },
      { status: 400, headers },
    );
  const status: CloudStatus = {
    sonos: { configured: !!oauthConfig("sonos"), connected: false },
    spotify: { configured: !!oauthConfig("spotify"), connected: false },
    rooms: [],
    devices: [],
  };
  for (const provider of ["sonos", "spotify"] as const) {
    if (getSession(request, provider)?.householdId !== home.data) continue;
    try {
      const session = await authorizedSession(
        request,
        provider,
        home.data,
        headers,
      );
      status[provider].connected = true;
      if (provider === "sonos") status.rooms = await sonosRooms(session);
      else {
        const snapshot = await spotifyDeviceSnapshot(session);
        status.devices = snapshot.devices;
        status.spotify.message = snapshot.message;
      }
    } catch (error) {
      const code =
        error instanceof MusicError ? error.code : "invalid-provider-response";
      if (error instanceof MusicError && error.status === 401)
        status[provider].connected = false;
      const name = provider === "spotify" ? "Spotify" : "Sonos";
      status[provider].message =
        code === "premium-required"
          ? `${name}: Inloggningen är sparad, men tjänsten nekar åtkomst till högtalarlistan. ${provider === "spotify" ? "Kontrollera att rätt Spotify-konto är tillagt under User Management i utvecklarappen och har Premium." : "Kontrollera integrationens kontobehörighet."}`
          : `${name}: ${musicMessage(code)}`;
    }
  }
  return Response.json(status, { headers });
}
export async function POST(request: Request) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (!sameOrigin(request))
    return Response.json(
      { message: "Otillåten begäran." },
      { status: 403, headers },
    );
  let input;
  try {
    input = activationSchema.parse(await request.json());
  } catch {
    return Response.json(
      { message: "Kontrollera stämningens inställningar och välj högtalare." },
      { status: 400, headers },
    );
  }
  if (running.has(input.householdId))
    return Response.json(
      { message: "En aktivering pågår. Vänta tills den är klar." },
      { status: 409, headers },
    );
  running.add(input.householdId);
  try {
    const sonos = await authorizedSession(
      request,
      "sonos",
      input.householdId,
      headers,
    );
    if (input.sourceMode === "sonos")
      return Response.json(await activateSonosMood(input, sonos), { headers });
    const spotify = await authorizedSession(
      request,
      "spotify",
      input.householdId,
      headers,
    );
    return Response.json(await activateMood(input, sonos, spotify), {
      headers,
    });
  } catch (error) {
    return responseError(error, headers);
  } finally {
    running.delete(input.householdId);
  }
}
export async function PATCH(request: Request) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (!sameOrigin(request)) return new Response(null, { status: 403, headers });
  try {
    const input = z
      .object({
        householdId: homeSchema,
        room: z.string().min(1).max(200),
        action: z.enum(["pause", "next", "volume"]).default("pause"),
        volume: z.number().int().min(0).max(100).optional(),
      })
      .refine((v) => v.action !== "volume" || v.volume !== undefined)
      .parse(await request.json());
    if (input.action === "volume") {
      await setMusicVolume(
        input.room,
        await authorizedSession(request, "sonos", input.householdId, headers),
        input.volume!,
      );
      return Response.json({ ok: true }, { headers });
    }
    await pauseMusic(
      input.room,
      await authorizedSession(request, "sonos", input.householdId, headers),
      input.action === "next" ? "skipToNextTrack" : "pause",
    );
    return Response.json(
      {
        message:
          input.action === "next"
            ? "Nästa låt begärd."
            : "Paus begärd på valt Sonos-rum.",
      },
      { headers },
    );
  } catch (error) {
    return responseError(error, headers);
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const provider of ["sonos", "spotify"] as const)
    headers.append("Set-Cookie", cookie(request, cookieName(provider), "", 0));
  return Response.json({ ok: true }, { headers });
}
