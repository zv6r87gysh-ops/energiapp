# Väder och självlärande poolplanering

## Verklig prognos

`GET /api/weather?postcode=13230` slår upp svensk postnummerpunkt via Zippopotam.us/GeoNames och hämtar MET Norways Locationforecast 2.0 compact, samma prognosleverantör som Yr. Postnummer normaliseras, land/postnummer/koordinater valideras och koordinater begränsas till fyra decimaler. Det är en ungefärlig postnummerposition, inte fastighetens exakta koordinater.

API:t validerar Celsius, m/s, tidsordning, utfärdandetid och aktuell timtäckning. Fel, saknade timmar, inaktuella prognoser och fel postnummer ger inga ersättningsvärden. UI:t visar dagens återstående timmar och morgondagens tillgängliga timmar i Europe/Stockholm, källor, licens och prognosens utfärdandetid. Temperatur är en prognos, inte en lokal termometeravläsning. Maxvind är högsta prognostiserade vindhastighet bland visade timvärden, inte vindbyar.

Backend identifierar Energihem med User-Agent, följer MET:s Expires och Last-Modified/If-Modified-Since, samlar parallella anrop och har begränsad cache samt backoff vid fel. Klienten uppdaterar inte i bakgrunden och återanvänder data tills Expires. Ingen API-nyckel behövs. MET Norway anges med CC BY 4.0-länk och bearbetade värden märks. Villkor: https://docs.api.met.no/doc/TermsOfService .

Livepostnummer och prognos verifierades 2026-10-21. Molnmiljön behöver `api.met.no`, `api.zippopotam.us` samt `NODE_USE_ENV_PROXY=1` (Node 24). Vercel använder normalt inte denna proxyflagga.

## Automatisk inlärning utan tekniska användarvärden

Användaren anger inga värmeförlusttal, COP, eleffekter eller manuella vattentemperaturer. Inställningarna innehåller bara önskemål: aktivering, tillåtet temperaturtapp, tillåten förvärmning och paustid att visa. Modellparametrar uppskattas först från verklig telemetri.

`lib/pool/learning.ts` beskriver kontraktet för en framtida **autentiserad serveranslutning** till poolboxen. Det omfattar hushåll/enhet, verifierad anslutning, vattentemperatur, samtidig utetemperatur, faktisk värmedrift, när driftstatus ändrades samt poolskydd. Valfri avläst eleffekt kan ge en energiskattning. Ett `verified`-fält är inte autentisering i sig: bara en autentiserad serveradapter får skapa detta underlag. Det finns ingen publik inmatnings- eller webhookväg som litar på att klienter påstår att data är verifierade.

**Pahlén Calidi VP-boxens anslutning finns ännu inte.** Den befintliga enhetsguiden registrerar uppgifter lokalt men läser inte temperatur/drift och styr inte värmepumpen. Applikationen skickar därför ingen telemetri till inlärningen och visar ett vänteläge. En riktig adapter, säker autentisering och beständig tidsserielagring behövs innan inlärningen kan köras med användarens box. Användaren har uppgett appen **Inverter Life**, men har ännu ingen box. Verifiera artikelnummer och tillgängliga API/protokoll mot den faktiska hårdvaran; anta inte att ett serienummer ger åtkomst eller att cirkulationspumpens status motsvarar kompressordrift.

Inlärningsmotorn använder icke överlappande temperaturfönster om 30–120 minuter, efter stabil driftstatus. Den kräver minst ett dygns historik, tre användbara avsvalningsfönster och tre uppvärmningsfönster. Ändrat poolskydd, fel tidsordning, hushållsbyte, orimliga värden, stora väderskiften och gamla aktuella avläsningar förhindrar eller begränsar inlärning. Robust median/MAD filtrerar avvikande perioder. Inlärningen ska använda vanliga driftperioder: den skapar aldrig en extra paus för att samla data.

Modellen lär `dT/dt ≈ -k × (vatten − ute) + värmetillskott` direkt i °C/timme. Det kräver inget manuellt förlusttal eller antagen COP. Framtida temperatur använder den exponentiella lösningen med verklig timprognos. Även med riktiga indata är framtida pooltemperatur en osäker uppskattning; sol, vind, poolskydd och badande kan ändra beteendet. Resultat märks preliminära/stabilare, aldrig som garanterad komfort. Nytt väder utanför tidigare temperaturintervall flaggas.

## Väderbaserat styrförslag

Den framåtblickande planen kombinerar inlärd värmebalans, aktuell mätning, MET-prognos och verkliga publicerade kvartpriser. Den föreslår förvärmning under prisgränsen inför dyra perioder, undviker värme när temperaturen räcker och uppskattar temperaturtapp under vald paus. Prisregel, manuell paus och driftfönster 07–23 respekteras. Saknat pris eller prognos får ingen gissad ersättning. Komfortkonflikter visas.

Planen är separat från den befintliga simulerade dagsgrafen och ger inga verkliga styrkommandon. Den lägger inte till påstått uppmätt förbrukning i dags-/månadssummorna. Pool-kWh beräknas bara om riktig eleffekt ingår i inlärningsunderlaget; annars visas vänteläge för effektmätning. Husets värmebehov kan inte läras ur pooldata: det kräver egen energihistorik och temperaturunderlag, och får inget fabricerat kWh-tal.

## Kontroller

- `npm test`: deterministiska fixturer för parser, felhantering, cache, kalibrering och planering. Testtelemetri skapas bara i `tests/fixtures`, aldrig i appen.
- `RUN_LIVE_WEATHER_TESTS=1 NODE_USE_ENV_PROXY=1 npx vitest run tests/weather.live.test.ts`: riktig postnummer- och MET-hämtning, separat opt-in.
- `npm run test:e2e`: postnummer, dagflikar, källmärkning, vänteläge utan boxmätningar, fel vid platsbyte och hushållsseparering på dator och mobil.

### Reservuppslagning för postnummer som saknas

Zippopotam.us saknar bland annat 13250 (verifierat HTTP 404). Vid misslyckad uppslagning används en lokal, källbelagd GeoNames-tabell endast för entydiga tresiffriga postnummerområden. UI:t märker detta som **områdesprognos** och anger att exakt postnummerpunkt saknas. Detta validerar inte att ett okänt postnummer existerar. Prognosvärdena hämtas fortfarande från MET Norway, aldrig från en lokal vädertabell.

`lib/weather/postal-districts.json` är ett bearbetat utdrag från https://github.com/zauberware/postal-codes-json-xml-csv/tree/b4be5a6e3c30c65dc7846e09ec9b70d65d0db7f5 (GeoNames, CC BY 4.0; datasetuppdatering 2026-07-31). Underlaget är `data/SE.zip`, `zipcodes.se.json`. Endast områden med minst tre listade postnummer och exakt samma ort (utan skillnad i stora/små bokstäver), latitud och longitud behålls. Svenska koordinatgränser valideras. 232 områden uppfyller kraven. Området 132xx har 39 listade poster som alla ger Saltsjö-Boo, 59.3173/18.255. Ingen koordinat för just 13250 hittas på.

Felmeddelanden skiljer nu på okänt postnummer, otillgänglig postnummertjänst och fel i MET-prognosen. Knappen Visa väder gör ett nytt försök även för samma sparade postnummer; serverns cache och backoff gäller fortfarande. Route-budgeten är 30 sekunder så att de två externa anropens tidsgränser ryms även i Vercel.
