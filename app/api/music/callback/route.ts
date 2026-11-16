import { z } from "zod";
import {
  cookie,
  cookieName,
  oauthConfig,
  providerSchema,
  readCookie,
  seal,
  tokenExchange,
  unseal,
  validState,
} from "../../../../lib/moods/oauth";
const flowSchema = z.object({
  state: z.string().min(1),
  verifier: z.string().min(1),
  householdId: z.string().min(1).max(100),
  until: z.number(),
});
export async function GET(request: Request) {
  const url = new URL(request.url),
    provider = providerSchema.safeParse(url.searchParams.get("provider"));
  if (!provider.success) return new Response("Ogiltig tjänst", { status: 400 });
  const config = oauthConfig(provider.data),
    headers = new Headers({ "Cache-Control": "no-store" });
  headers.append(
    "Set-Cookie",
    cookie(request, cookieName(provider.data, true), "", 0),
  );
  let result = "login-failed";
  try {
    if (!config || url.origin !== config.origin)
      throw Error("Missing configuration");
    const code = url.searchParams.get("code"),
      state = url.searchParams.get("state"),
      value = readCookie(request, cookieName(provider.data, true));
    if (
      !code ||
      code.length > 4000 ||
      !state ||
      !value ||
      url.searchParams.has("error")
    )
      throw Error("Invalid flow");
    const flow = flowSchema.parse(unseal(value, config.key));
    if (flow.until < Date.now() || !validState(flow.state, state))
      throw Error("Invalid state");
    const data = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirect,
    });
    if (provider.data === "spotify") data.set("code_verifier", flow.verifier);
    const session = {
      ...(await tokenExchange(provider.data, data)),
      householdId: flow.householdId,
    };
    headers.append(
      "Set-Cookie",
      cookie(
        request,
        cookieName(provider.data),
        seal(session, config.key),
        14 * 86400,
      ),
    );
    result = "connected";
  } catch {
    /* No provider errors or secrets in redirects or logs. */
  }
  headers.set(
    "Location",
    new URL(
      `/installningar?music=${result}#music-settings`,
      request.url,
    ).toString(),
  );
  return new Response(null, { status: 303, headers });
}
