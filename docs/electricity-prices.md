# Publicerade spotpriser

Källa: [Elprisetjustnu.se – officiell API-dokumentation](https://www.elprisetjustnu.se/elpris-api).

## Verifierat 21 oktober 2026

Den officiella dokumentationen anger att API:et är öppet, gratis och fritt att använda. Ingen API-nyckel krävs. Attribution uppmuntras och visas i appen. API:et levererar kvartsvärden sedan 1 oktober 2025. Priserna anges i SEK/kWh, utan moms, tillägg och skatter. Morgondagens priser kommer tidigast kl. 13 svensk tid; exakt publiceringstid garanteras inte. Inget numeriskt anropstak anges i den lästa dokumentationen. Vi återanvänder svar i fem minuter och hämtar bara vid behov.

Leverantören hämtar ENTSO-E-data i euro och konverterar med sin valutakurs. Priserna kan därför avvika något från officiella SEK-priser. Appen visar leverantörens publicerade spotpriser och påstår inte att de är användarens slutliga avtalspris.

Liveverifiering med HTTP 200: 2026-10-21, SE1, SE2, SE3 och SE4, 96 sammanhängande kvartar per område, 00.00–24.00 Europe/Stockholm. Morgondagen 2026-10-22 gav 404 i alla fyra områden vid kontrollen före kl. 13 och behandlas som opublicerad. Kontraktsvalideringen har också testats mot dessa hämtade livefiler. Tester med konstruerade 92/100-kvartsdygn täcker sommar-/vintertidsbyte; de är inte livehistorik.

## Drift

`GET /api/electricity-prices?area=SE3&day=today` stöder SE1–SE4 och today/tomorrow, räknat i Europe/Stockholm. Publik prishämtning är aktiverad som standard, även på Vercel. Valfri servervariabel `ELECTRICITY_PRICES_ENABLED=false` stänger av den. Ingen hemlighet behövs.

Servern har timeout, Zod-validering och komplett dygnskontroll: 92/96/100 sammanhängande kvartar. UTC-tidsstämplar och priser i öre/kWh normaliseras; negativa priser bevaras och ingen skatt eller moms läggs på spotpriset. Timpriser godtas inte som kvartspriser. En datumnycklad processcache på fem minuter behåller faktisk hämtningstid. Klienten uppdaterar var femte minut och på fokus/nätverksändring. Underliggande dygn följer svensk kalender.

Felläge, avstängd integration och opublicerad morgondag skiljs åt. Prisuppgifter äldre än tio minuter döljs. Ingen demo-fallback används. Källa, hämtningstid och att priset saknar moms/avgifter visas. Testfixturer är inte verkliga leverantörsdata.

I Codex-miljön används befintlig nätverksproxy: starta Node med `NODE_USE_ENV_PROXY=1` när servern behöver extern åtkomst. Node 24:s inbyggda proxyhantering bevarar TLS-verifiering. Vercel använder sin vanliga nätverksåtkomst och behöver inte denna variabel. Domänerna `www.elprisetjustnu.se` och `elprisetjustnu.se` är tillåtna i molnmiljön.

Översiktens aktuella elpris och prisgraf samt sidan Elpriser använder denna källa. Hushållsförbrukning, besparingar, pool och laddplanering fortsätter vara separata demoberäkningar. De får inte tolkas som verkliga kostnadsbesparingar.
