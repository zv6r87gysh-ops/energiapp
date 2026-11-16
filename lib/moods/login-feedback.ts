// Only these fixed codes reach the browser. Provider error descriptions, tokens and codes never do.
export const loginMessages: Record<string, string> = {
  connected: "Inloggningen slutfördes. Anslutningsstatus visas nedan.",
  "login-failed":
    "Inloggningen kunde inte slutföras. Försök igen från samma Safari-fönster.",
  "not-configured": "Appens inloggning är inte färdigkonfigurerad på servern.",
  "origin-mismatch":
    "Inloggningen startades på en annan adress än den som är konfigurerad. Använd appens ordinarie adress.",
  "login-denied":
    "Åtkomst godkändes inte. Starta inloggningen igen och godkänn anslutningen.",
  "login-state-missing":
    "Inloggningens tillfälliga cookie saknas. Öppna Energihem och logga in i samma Safari-fönster igen.",
  "login-state-invalid":
    "Inloggningen kunde inte kopplas till detta webbläsarfönster. Starta en ny inloggning härifrån.",
  "login-expired": "Inloggningsförsöket har gått ut. Starta inloggningen igen.",
  "oauth-invalid-client":
    "Tjänsten godkänner inte appens Client ID eller Client Secret. Kontrollera värdena i Vercels Production-inställningar och driftsätt igen.",
  "oauth-invalid-grant":
    "Tjänsten kunde inte verifiera inloggningskoden. Starta en ny inloggning. Om det upprepas: kontrollera att Redirect URI i utvecklarappen stämmer exakt.",
  "oauth-token-rejected":
    "Tjänsten nekade inloggningsutbytet. Kontrollera utvecklarappens behörigheter och registrerade Redirect URI.",
  "session-too-large":
    "Inloggningen lyckades, men sessionen är för stor för webbläsarens cookie. Anslutningen kunde därför inte sparas.",
  "provider-unavailable":
    "Inloggningstjänsten kunde inte nås. Försök igen om en stund.",
  "invalid-provider-response":
    "Inloggningstjänstens svar kunde inte verifieras. Försök igen.",
};
export function loginFeedback(code: string | null, provider: string | null) {
  if (!code || !Object.hasOwn(loginMessages, code)) return "";
  const name =
    provider === "spotify"
      ? "Spotify"
      : provider === "sonos"
        ? "Sonos"
        : "Musik";
  return `${name}: ${loginMessages[code]} (kod: ${code})`;
}
