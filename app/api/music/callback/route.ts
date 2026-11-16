import { z } from "zod";
import {
  MusicError,
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
import { loginMessages } from "../../../../lib/moods/login-feedback";
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
    if (!config) throw new MusicError("not-configured");
    if (url.origin !== config.origin) throw new MusicError("origin-mismatch");
    const code = url.searchParams.get("code"),
      state = url.searchParams.get("state"),
      value = readCookie(request, cookieName(provider.data, true));
    if (url.searchParams.has("error")) throw new MusicError("login-denied");
    if (!value) throw new MusicError("login-state-missing");
    if (!code || code.length > 4000 || !state)
      throw new MusicError("login-state-invalid");
    let flow;
    try {
      flow = flowSchema.parse(unseal(value, config.key));
    } catch {
      throw new MusicError("login-state-invalid");
    }
    if (flow.until < Date.now()) throw new MusicError("login-expired");
    if (!validState(flow.state, state))
      throw new MusicError("login-state-invalid");
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
  } catch (error) {
    if (error instanceof MusicError && Object.hasOwn(loginMessages, error.code))
      result = error.code;
  }
  headers.set(
    "Location",
    new URL(
      `/installningar?music=${result}&provider=${provider.data}#music-settings`,
      request.url,
    ).toString(),
  );
  return new Response(null, { status: 303, headers });
}
