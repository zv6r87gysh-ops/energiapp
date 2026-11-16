import { z } from "zod";
import {
  authorizedSession,
  MusicError,
  musicMessage,
} from "../../../../lib/moods/oauth";
import { sonosCatalog } from "../../../../lib/moods/sonos-direct";
export const maxDuration = 60;
export async function GET(request: Request) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  try {
    const url = new URL(request.url);
    const home = z
      .string()
      .min(1)
      .max(100)
      .parse(url.searchParams.get("householdId"));
    const room = z.string().min(1).max(200).parse(url.searchParams.get("room"));
    return Response.json(
      await sonosCatalog(
        room,
        await authorizedSession(request, "sonos", home, headers),
      ),
      { headers },
    );
  } catch (error) {
    const e =
      error instanceof MusicError ? error : new MusicError("invalid-room", 400);
    return Response.json(
      { message: musicMessage(e.code), code: e.code },
      { status: e.status, headers },
    );
  }
}
