# Energihem

Svensk, responsiv energiapplikation byggd med Next.js App Router, TypeScript strict, Tailwind CSS, en shadcn/ui-baserad lokal Button-komponent, Lucide, Recharts och Zod. **Hushållets värden är demo. Elpriser hämtas från en publik källa. Ingen hårdvara eller användarautentisering är ansluten.**

## Starta lokalt

Node.js 24 LTS och npm 11 används i denna miljö.

```sh
npm ci
npm run dev
```

Öppna utvecklingsservern på port 3000. Ingen `.env` eller API-nyckel krävs. För produktionsläge: `npm run build` följt av `npm start`. Varje molnuppgift är redan isolerad: använd befintlig checkout utan extra Git-worktree.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright använder systemets `/usr/bin/chromium` när den finns, annars sin installerade webbläsare. Valfri override: `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

Vid begränsade hemkatalogsrättigheter: `npm ci --cache /workspace/.npm-cache`. Playwright kan använda `PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright` vid både installation och testkörning.

## Funktioner

Alla tio huvudkategorier har separata routes. Översikt, förbrukning, kostnadsprognos, elpriser för fyra områden, pooldemo, laddplanering, fordonsregister, fem frånkopplade värmezoner, statistik, besparingsscenarier och inställningar ingår. Mobil bottennavigation har en meny för samtliga kategorier. Ljust/mörkt tema, lokalt sparade hushåll, redigerbara avgifter, guide för registrering av egna enheter och lokala simulerade inbjudningar ingår.

Bilväljaren söker bland 18 märken. Modellnamn är sökförslag; **variant, årsmodell och tekniska specifikationer anges manuellt och är inte en verifierad fordonsdatabas**. Den förifyllda EX30-bilens batteri och laddeffekt är demoantaganden. Flera bilar, redigering, borttagning och standardbil stöds. Zaptec antas inte kunna identifiera bilen eller läsa batterinivå.

PWA-manifest, PNG-ikoner och en service worker finns. Vid offline-navigation visas en uttrycklig offlinesida. Inga mätvärden, API-svar eller hemligheter cachas av service workern. Installation på iPhone kräver HTTPS och Safari → Dela → Lägg till på hemskärmen. Fysisk iPhone-installation har inte verifierats i molnmiljön.

## Demoantaganden och begränsningar

Den levande familjemodellen följer aktuell svensk kalender och verkliga spotpriser. Kvartstidsstämplar lagras i UTC och visas i Europe/Stockholm. Hushållsvärden är modellerade, inte uppmätta. Historiska månadsserier och månadsprognoser byggda på den tidigare statiska demodagen visas inte längre som underlag för modellen. Prishistorik krävs för sådana jämförelser.

Kostnadsmodellen använder avgifter exklusive moms, energiskatt exakt en gång och moms exakt en gång. Rörliga kostnader i familjemodellen använder samma verkliga pris och förbrukningskvart. Effektavgift är ett manuellt månadsbelopp och tidsberoende nätavgift ett manuellt vägt tillägg. Fasta avgifter ingår inte i jämförelsen mellan driftlägen. Poolbesparing är inte verifierad; konstant drift visas endast som ett separat hypotetiskt scenario.

Laddplanen väljer billigaste tillåtna kvartar före sluttiden nästa demodygn med AC-gräns, laddförlust och manuellt energibehov. Den visar om tiden eller prisgränsen hindrar målet. Den tar inte hänsyn till verklig lastbalansering, bilens laddkurva eller fysisk styrning. All start/paus och poolstyrning påverkar bara lokal demostatus.

localStorage är inte en säker databas. Använd inte personuppgifter, riktiga registreringsnummer, tokens eller lösenord. Inbjudningar skickar ingen e-post. Hushållsval är endast lokal datauppdelning, inte behörighetskontroll. Anslutet läge är avsiktligt otillgängligt.

Se [arkitektur och nästa faser](docs/architecture.md) och [integrationsstatus](docs/integrations.md).

## Framtida driftsättning

Vercel: importera repositoryt, välj Next.js, installera med `npm ci`, bygg med `npm run build`. Fas 1 kräver inga hemligheter. Publicering till Vercel har inte utförts. Säker fleranvändardrift kräver fas 2: Supabase Auth, migrationer, RLS och serverbaserad behörighetskontroll. Använd aldrig en service role-nyckel i frontend. Riktiga integrationer införs först efter protokoll-, säkerhets- och villkorsgranskning.

## Verkliga elpriser

Översiktens elpris och prisgraf samt sidan Elpriser hämtar publicerade kvartspriser från Elprisetjustnu.se via en serverroute. SE1–SE4, aktuellt pris, nästa kvart, dygnsstatistik och morgondagens priser när de publicerats stöds. Källa och hämtningstid visas. Spotpriset är exklusive moms, skatter, påslag och nätavgifter. Leverantörens valutakurs kan ge mindre avvikelser från officiella SEK-priser. Fel ersätts aldrig med demopriser.

Integrationens villkor och live-data för samtliga fyra områden verifierades 21 oktober 2026. Prishämtningen är aktiv som standard och kräver inga nycklar eller Vercel-inställningar. Valfritt: `ELECTRICITY_PRICES_ENABLED=false` stänger av den. Hushållsförbrukning, laddplanering och kostnadsprognoser är fortfarande demo. Se [teknik, verifiering och källans villkor](docs/electricity-prices.md).

I Codex-miljön: använd `NODE_USE_ENV_PROXY=1 npm run dev` för att Node ska använda den tillåtna nätverksproxyn vid externa anrop. Detta behövs inte på Vercel.

## Smart styrning av huset · Demo

Knappen **Aktivera smart styrning** öppnar en kategoriväljare som finns på alla sidor. Pool och billaddare kan aktiveras i demonstrationen. Golvvärme och övriga enheter visas men är spärrade tills integrationer och kompatibilitet har verifierats. All aktivering är uttryckligen simulering och skickar inga hårdvarukommandon.

Val, aktivt läge och paus sparas per hushåll i webbläsaren. Huvudknappen och poolens/laddarens egna reglage använder samma inställning. **Pausa alla** pausar de smarta demovalen men behåller kategorierna; **Stäng av och rensa val** tar bort dem. Manuellt startad simulerad laddning är ett separat reglage och stoppas inte av att smart planering pausas. Redigering i dialogen sparas först när användaren bekräftar. Äldre lokala demoinställningar startar avstängda i den nya husstyrningen.

## Levande familjemodell

Förbrukningen på översikten och förbruknings-, kostnads-, statistik- och besparingssidorna kommer nu från en gemensam modell för två vuxna och två barn. Den följer verklig svensk tid, varierar var femte sekund och använder dagens verkliga kvartpriser för energikostnad, avgifter och moms. Modellen räknas om med aktuella inställningar; grafen är inte uppmätt eller loggad historik. Grundlasten representerar hushåll, rutiner och uppvärmning. Pool och bil har separata dagliga energibehov och driftfönster.

Under Inställningar finns regler per kategori: fast gräns i öre/kWh eller procent av högsta priset under kommande 24 förflutna timmar. Priset **lika med eller över** gränsen pausar modellen. Procentregeln inväntar en komplett publicerad 24-timmarsperiod; den gissar inte morgondagens priser. Om alla framtida priser är noll/negativa skapas ingen positiv prispaus. Kategoriernas status visas i navigationen och på respektive sida. Manuell laddstart åsidosätter prisregeln endast i modellen.

Besparingsvyn visar en normaliserad prisskillnad för samma levererade energi. Otillgodosett eller uppskjutet energibehov redovisas separat och räknas inte som besparing. Fasta avgifter ingår inte i den rörliga driftjämförelsen. En verifierad poolkomfortmodell, historisk prislagring och verklig styrning återstår. Golvvärme är fortfarande ej ansluten och kan inte prisstyras.

## Egna enheter

Knappen Lägg till egen enhet öppnar en guide för poolens WiFi-box, realtidsmätare, billaddare eller annan modell. Tillverkare, exakt modell och serienummer/enhets-ID krävs. ID-kontrollen validerar bara formuläret och förhindrar dubbletter inom samma hushåll; den autentiserar inte hos tillverkaren. Enheter sparas lokalt med status **Förberedd – ej ansluten**, kan redigeras och tas bort. Inga lösenord eller API-nycklar ska anges. En registrering aktiverar inga mätvärden eller styrkommandon.

### Placering och ackumulerad förbrukning

Smart styrning visas på Översikt och Aktuell förbrukning. Enhetsguiden visas endast under Pool, Golvvärme och Elbilsladdning; registrerade enheter hanteras fortsatt under Inställningar.

Aktuell förbrukning visar total modellerad energi idag och denna månad, uppdaterad var femte sekund. Dagens modell räknas om med aktuella regler. Dagliga snapshots sparas lokalt per hushåll i `energihem-energy-v1/<householdId>` och summeras inom svensk kalendermånad. Saknade och delvis sparade dagar anges uttryckligen: månadsräknaren är inte en komplett mätarhistorik. Stängd app, annan webbläsare eller rensad lagring ger luckor; inga historiska förbrukningsvärden fabriceras. En verklig månadsförbrukning kräver en ansluten mätare med historik.
