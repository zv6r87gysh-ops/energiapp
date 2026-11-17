import { z } from "zod";
import {
  authorizedSession,
  sameOrigin,
  MusicError,
  musicMessage,
} from "@/lib/moods/oauth";
import {
  playerState,
  playerCommand,
  playerCommandSchema,
} from "@/lib/moods/player";
export const maxDuration = 60;
const target = z.object({
  householdId: z.string().min(1).max(100),
  room: z.string().min(1).max(200),
});
async function handle(request: Request, write: boolean) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (write && !sameOrigin(request))
    return Response.json(
      { message: "Otillåten begäran." },
      { status: 403, headers },
    );
  try {
    const raw = write
      ? await request.json()
      : Object.fromEntries(new URL(request.url).searchParams);
    const input = target.parse(raw);
    const command = write ? playerCommandSchema.parse(raw) : null;
    const session = await authorizedSession(
      request,
      "sonos",
      input.householdId,
      headers,
    );
    const data = command
      ? await playerCommand(input.room, session, command)
      : await playerState(input.room, session);
    return Response.json(data, { headers });
  } catch (error) {
    const code =
      error instanceof MusicError ? error.code : "invalid-provider-response";
    return Response.json(
      { message: musicMessage(code), code },
      {
        headers,
        status:
          error instanceof z.ZodError
            ? 400
            : error instanceof MusicError
              ? error.status
              : 502,
      },
    );
  }
}
export const GET = (request: Request) => handle(request, false);
export const PATCH = (request: Request) => handle(request, true);
