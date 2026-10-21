# Energihem

Svensk, responsiv energiapplikation byggd med Next.js App Router, TypeScript strict, Tailwind CSS, en shadcn/ui-baserad lokal Button-komponent, Lucide, Recharts och Zod. **Fas 1 är en lokal demo. Ingen hårdvara eller användarautentisering är ansluten.**

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

Alla tio huvudkategorier har separata routes. Översikt, förbrukning, kostnadsprognos, elpriser för fyra områden, pooldemo, laddplanering, fordonsregister, fem frånkopplade värmezoner, statistik, besparingsscenarier och inställningar ingår. Mobil bottennavigation har en meny för samtliga kategorier. Ljust/mörkt tema, lokalt sparade hushåll, redigerbara avgifter, demoenhetsguide och lokala simulerade inbjudningar ingår.

Bilväljaren söker bland 18 märken. Modellnamn är sökförslag; **variant, årsmodell och tekniska specifikationer anges manuellt och är inte en verifierad fordonsdatabas**. Den förifyllda EX30-bilens batteri och laddeffekt är demoantaganden. Flera bilar, redigering, borttagning och standardbil stöds. Zaptec antas inte kunna identifiera bilen eller läsa batterinivå.

PWA-manifest, PNG-ikoner och en service worker finns. Vid offline-navigation visas en uttrycklig offlinesida. Inga mätvärden, API-svar eller hemligheter cachas av service workern. Installation på iPhone kräver HTTPS och Safari → Dela → Lägg till på hemskärmen. Fysisk iPhone-installation har inte verifierats i molnmiljön.

## Demoantaganden och begränsningar

Demots fasta referensdag är 21 oktober 2026 kl. 14.00 Europe/Stockholm. Priser och grafer är illustrativa, inte historiska marknadsdata. Kvartstidsstämplar lagras i UTC, tidszonens dygnsgränser testas separat för 23/25-timmarsdygn. Diagrammens modellvärden är inte underlag för verkliga beslut. Dashboardens och kostnadssidans totalsummor härleds från en gemensam demoserie. Statistikens anpassade datumintervall filtrerar demots tillgängliga dygn, 1–21 oktober 2026.

Kostnadsmodellen använder avgifter exklusive moms, energiskatt exakt en gång och moms exakt en gång. Effektavgift är ett manuellt månadsbelopp och tidsberoende nätavgift ett manuellt vägt öre-tillägg. Prognosen använder demots förbrukning hittills, ett antaget förbrukningsvägt spotpris på 62 öre/kWh och proportionerade fasta avgifter. Den är en dygnstakt med illustrativt ±15 %-intervall. Besparingshistorik är modellerad demonstration; poolbesparing är inte verifierad och används inte som faktisk effekt. Konstant pooldrift är en separat hypotetisk jämförelse med olika energibehov.

Laddplanen väljer billigaste tillåtna kvartar före sluttiden nästa demodygn med AC-gräns, laddförlust och manuellt energibehov. Den visar om tiden eller prisgränsen hindrar målet. Den tar inte hänsyn till verklig lastbalansering, bilens laddkurva eller fysisk styrning. All start/paus och poolstyrning påverkar bara lokal demostatus.

localStorage är inte en säker databas. Använd inte personuppgifter, riktiga registreringsnummer, tokens eller lösenord. Inbjudningar skickar ingen e-post. Hushållsval är endast lokal datauppdelning, inte behörighetskontroll. Anslutet läge är avsiktligt otillgängligt.

Se [arkitektur och nästa faser](docs/architecture.md) och [integrationsstatus](docs/integrations.md).

## Framtida driftsättning

Vercel: importera repositoryt, välj Next.js, installera med `npm ci`, bygg med `npm run build`. Fas 1 kräver inga hemligheter. Publicering till Vercel har inte utförts. Säker fleranvändardrift kräver fas 2: Supabase Auth, migrationer, RLS och serverbaserad behörighetskontroll. Använd aldrig en service role-nyckel i frontend. Riktiga integrationer införs först efter protokoll-, säkerhets- och villkorsgranskning.
