import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import {
  cookie,
  cookieName,
  endpoints,
  oauthConfig,
  providerSchema,
  seal,
} from "../../../../lib/moods/oauth";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = providerSchema.safeParse(url.searchParams.get("provider"));
  const home = z
    .string()
    .min(1)
    .max(100)
    .safeParse(url.searchParams.get("householdId"));
  if (!provider.success || !home.success)
    return new Response("Ogiltig anslutning", { status: 400 });
  const config = oauthConfig(provider.data);
  if (!config || url.origin !== config.origin)
    return Response.redirect(
      new URL(
        "/installningar?music=not-configured#music-settings",
        request.url,
      ),
      303,
    );
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url");
  const destination = new URL(endpoints[provider.data].authorize);
  destination.search = new URLSearchParams({
    client_id: config.id,
    response_type: "code",
    redirect_uri: config.redirect,
    scope: endpoints[provider.data].scope,
    state,
  }).toString();
  if (provider.data === "spotify") {
    destination.searchParams.set("code_challenge_method", "S256");
    destination.searchParams.set(
      "code_challenge",
      createHash("sha256").update(verifier).digest("base64url"),
    );
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: destination.toString(),
      "Cache-Control": "no-store",
      "Set-Cookie": cookie(
        request,
        cookieName(provider.data, true),
        seal(
          {
            state,
            verifier,
            householdId: home.data,
            until: Date.now() + 600000,
          },
          config.key,
        ),
        600,
      ),
    },
  });
}
