import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { loginMessages } from "./login-feedback";
export const providerSchema = z.enum(["sonos", "spotify"]);
export type Provider = z.infer<typeof providerSchema>;
export const endpoints = {
  sonos: {
    authorize: "https://api.sonos.com/login/v3/oauth",
    token: "https://api.sonos.com/login/v3/oauth/access",
    scope: "playback-control-all",
  },
  spotify: {
    authorize: "https://accounts.spotify.com/authorize",
    token: "https://accounts.spotify.com/api/token",
    scope: "user-read-playback-state user-modify-playback-state",
  },
};
export class MusicError extends Error {
  volumeApplied = false;
  constructor(
    public code: string,
    public status = 502,
  ) {
    super(code);
  }
}
export function oauthConfig(provider: Provider) {
  const prefix = provider.toUpperCase();
  const id = process.env[`${prefix}_CLIENT_ID`],
    secret = process.env[`${prefix}_CLIENT_SECRET`];
  const key = process.env.MUSIC_SESSION_SECRET;
  let origin: URL;
  try {
    origin = new URL(process.env.MUSIC_PUBLIC_ORIGIN ?? "");
  } catch {
    return null;
  }
  if (
    !id ||
    !secret ||
    !key ||
    key.length < 32 ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    (origin.protocol !== "https:" &&
      !(
        origin.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(origin.hostname)
      ))
  )
    return null;
  return {
    id,
    secret,
    key,
    origin: origin.origin,
    redirect: `${origin.origin}/api/music/callback?provider=${provider}`,
  };
}
const keyFor = (secret: string) => createHash("sha256").update(secret).digest();
export function seal(value: unknown, secret: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", keyFor(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const result = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
  if (result.length > 3500) throw new MusicError("session-too-large", 502);
  return result;
}
export function unseal(value: string, secret: string): unknown {
  if (value.length > 3600) throw Error("Invalid session");
  const bytes = Buffer.from(value, "base64url");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    keyFor(secret),
    bytes.subarray(0, 12),
  );
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString(
      "utf8",
    ),
  );
}
export function cookieName(provider: Provider, state = false) {
  return `energihem_${provider}${state ? "_oauth" : ""}`;
}
export function readCookie(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
export function cookie(
  request: Request,
  name: string,
  value: string,
  age: number,
) {
  return `${name}=${value}; Path=/api/music; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive(),
});
export const sessionSchema = z.object({
  access: z.string().min(1),
  refresh: z.string().min(1),
  expires: z.number(),
  until: z.number(),
  householdId: z.string().min(1).max(100),
});
export type Session = z.infer<typeof sessionSchema>;
export function getSession(
  request: Request,
  provider: Provider,
): Session | null {
  const config = oauthConfig(provider),
    value = readCookie(request, cookieName(provider));
  try {
    if (!config || !value) return null;
    const session = sessionSchema.parse(unseal(value, config.key));
    return session.until > Date.now() ? session : null;
  } catch {
    return null;
  }
}
export async function tokenExchange(
  provider: Provider,
  data: URLSearchParams,
  previous?: Session,
): Promise<Session> {
  const config = oauthConfig(provider);
  if (!config) throw new MusicError("not-configured", 503);
  let r: Response;
  try {
    r = await fetch(endpoints[provider].token, {
      method: "POST",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12000),
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.id}:${config.secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: data,
    });
  } catch {
    throw new MusicError("provider-unavailable");
  }
  if (!r.ok) {
    let reason: unknown;
    try {
      reason = (await r.json()).error;
    } catch {
      /* Ignore untrusted error bodies. */
    }
    const code =
      reason === "invalid_client" || r.status === 401
        ? "oauth-invalid-client"
        : reason === "invalid_grant"
          ? "oauth-invalid-grant"
          : "oauth-token-rejected";
    throw new MusicError(code, 401);
  }
  const parsed = tokenSchema.safeParse(await r.json());
  if (!parsed.success || !(parsed.data.refresh_token ?? previous?.refresh))
    throw new MusicError("invalid-provider-response");
  return {
    access: parsed.data.access_token,
    refresh: parsed.data.refresh_token ?? previous!.refresh,
    expires: Date.now() + parsed.data.expires_in * 1000,
    until: previous?.until ?? Date.now() + 14 * 86400000,
    householdId: previous?.householdId ?? "",
  };
}
export async function authorizedSession(
  request: Request,
  provider: Provider,
  home: string,
  headers: Headers,
) {
  let session = getSession(request, provider);
  if (!session || session.householdId !== home)
    throw new MusicError(`${provider}-login-required`, 401);
  if (session.expires < Date.now() + 60000) {
    session = await tokenExchange(
      provider,
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: session.refresh,
      }),
      session,
    );
    headers.append(
      "Set-Cookie",
      cookie(
        request,
        cookieName(provider),
        seal(session, oauthConfig(provider)!.key),
        14 * 86400,
      ),
    );
  }
  return session;
}
export function validState(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function musicMessage(code: string) {
  const messages: Record<string, string> = {
    "not-configured":
      "Molnanslutningen behöver aktiveras med appnycklar på servern.",
    "sonos-login-required": "Logga in på Sonos för detta hushåll.",
    "spotify-login-required": "Logga in på Spotify för detta hushåll.",
    "login-required": "Inloggningen har gått ut. Anslut kontot igen.",
    "provider-unavailable": "Musiktjänsten kunde inte nås. Försök igen.",
    "invalid-provider-response": "Musiktjänstens svar kunde inte verifieras.",
    "no-playlists":
      "Inga spellistor hittades för musikstilen. Prova andra sökord.",
    "sonos-permission-denied":
      "Sonos nekar åtkomst. Kontrollera Control-integrationens behörighet och att rätt Sonos-konto är anslutet.",
    "sonos-catalog-unavailable":
      "Sonos kunde inte lämna favoriter eller sparade spellistor. Uppdatera Sonos-valen och kontrollera anslutningen.",
    "player-action-unavailable":
      "Sonos eller musiktjänsten tillåter inte den här åtgärden för den aktuella låten.",
    "same-track":
      "Sonos rapporterar fortfarande samma låt. Kontrollera att musikvalet innehåller flera låtar och tillåter spårbyte.",
    "shuffle-unavailable":
      "Sonos bekräftar inte shuffle utan låtrepetition. Välj en spellista som stöder shuffle.",
    "sonos-pool-empty":
      "Välj minst ett Sonos-musikval för denna stämning i inställningarna. Välj flera för slumpvariation.",
    "sonos-selection-missing":
      "Ett sparat Sonos-musikval finns inte längre i det valda rummets hem. Hämta Sonos-valen igen och uppdatera stämningen.",
    "device-not-speaker":
      "Vald Spotify-enhet är en telefon, dator eller en okänd enhet. Sonos-läget startar inte musik där. Välj en tillgänglig högtalare.",
    "device-unavailable":
      "Den valda Spotify Connect-enheten är inte tillgänglig. Välj Sonos i Spotify och uppdatera enheterna.",
    "invalid-room":
      "Välj ett tillgängligt Sonos-rum och en Spotify Connect-enhet i inställningarna.",
    "premium-required":
      "Spotify nekade uppspelningen. Kontrollera Premium, appbehörighet och högtalarens tillgänglighet.",
    "rate-limited": "Musiktjänsten begränsar anropen. Vänta och försök igen.",
  };
  return (
    messages[code] ??
    loginMessages[code] ??
    "Musikkommandot kunde inte bekräftas. Kontrollera spelaren innan du försöker igen."
  );
}
