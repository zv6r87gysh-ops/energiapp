# Utebelysning och förberedd Plejd-anslutning

## Funktion nu

Översikt har en tydligt märkt **förhandsvisning** med en av/på-knapp. Den tänder och släcker ett SVG-lager på det befintliga, lokalt lagrade husfotot. Originalfotot, dess IndexedDB-nycklar och övriga husmarkeringar ändras inte. Belysningen är schematisk och följer användarens röda markeringar: fyra downlights vid fasad/pergola, fyra markspots längs vänster gång/hedge, sex längs högra terrasskanten och sex längs den främre trädgårdskanten. Positionerna är normaliserade till det ursprungliga husfotots 1596 × 1422 koordinater, inte skärmbildens svarta marginaler eller macOS-verktygsfält.

Tänd förhandsvisning ger varmt ljus med nedåtriktade ljuskäglor, mjuka ljusfläckar och en svag mörkare ton för kontrast i dagsfotot. Detta är en visuell illustration, inte en fysisk ljusberäkning eller information om solens aktuella läge. Släckt förhandsvisning tar bort ljuslagret och visar endast små schematiska armaturpunkter. `prefers-reduced-motion` respekteras.

`Household.outdoorLighting` sparas med hushållets övriga lokala inställningar. Befintliga hushåll börjar med släckt förhandsvisning. Statusen är alltid **Plejd · Ej ansluten**, även om anslutningsreferenser har förberetts. Förhandsvisningens tillstånd är inte lampornas verkliga tillstånd. Ingen förbrukning eller besparing för belysningen fabriceras eller läggs till i energimodellen.

## Förberedelser som finns

Under Inställningar → Utebelysning · Plejd kan två valfria, icke-hemliga referenser sparas: en bryggreferens och en ljusgruppsreferens. Båda lämnas tomma tills utrustningen finns. Detta är endast förberedda mappningar, inte en anslutning. Lösenord, åtkomsttoken och krypteringsnycklar ska inte skrivas i formuläret eller sparas i webbläsarens lokala data.

- `lib/lighting/contracts.ts` innehåller validerade konfigurations-, kommando- och statuskontrakt.
- `lib/lighting/adapter.ts` beskriver en framtida adapter med `read(householdId, groupReference)` och `setPower(command)`.
- Kommandon har hushåll, ljusgrupp, begärt av/på-läge samt ett UUID för spårning/idempotens.
- Den levererade `UnconfiguredPlejdAdapter` gör inga nätverksanrop, rapporterar fysisk status **unknown** och avvisar kommandon med `not-configured`.
- Förhandsvisningsknappen använder aldrig hårdvaruadaptern.

## När Plejd installeras

Identifiera exakt Plejd-utrustning, grupper och ett kompatibelt anslutningssätt. En Plejd-gateway antas inte automatiskt ha ett tillgängligt styr-API. En lokal brygga kan bli aktuell; Home Assistant är ett möjligt alternativ, inget krav och ingen färdig anslutning i denna ändring. Inget officiellt Plejd-protokoll eller moln-API påstås vara verifierat här.

Implementera vald adapter på servern/lokal brygga med säker autentisering och serverlagrade hemligheter. Lägg till en autentiserad serverväg som kontrollerar hushållsbehörighet och registrerad ljusgrupp, accepterar explicit önskat läge (inte en blind toggle), hanterar idempotens och timeout och läser tillbaka bekräftad enhetsstatus. Fel/offline ska ge **okänd** status och får inte visas som lyckad styrning. Automatisk återsändning av gamla förhandsvisningsval får inte ske när bryggan ansluts.

Därefter kan UI:t få ett separat riktigt styrreglage och verifierad status. Förhandsvisning och fysisk styrning ska fortsätta vara skilda. Verklig styrning återstår alltså tills en installerad brygga kan anslutas och provas.

## Verifiering

Enhetstester kontrollerar kompatibilitet med äldre hushåll, validering och att den okonfigurerade adaptern inte utför hårdvaruanrop. Webbläsartester på dator och mobil kontrollerar synliga ljuslager, av/på, tangentbord, sparat foto, omladdning, hushållsseparering, sparade förberedelsereferenser och att inga Plejd-/lighting-kommandon skickas.
