# Arkitektur och fortsättning

## Struktur

- `app/`: App Router, tio förgenererade sidor, metadata och PWA-manifest.
- `components/energy-app.tsx`: klientgränssnitt och lokala interaktioner.
- `components/ui/button.tsx`: komponerbar Button med Radix Slot, shadcn/ui-principer.
- `lib/models.ts`: typer för alla 21 begärda domänentiteter och Zod-validering av fordon.
- `lib/demo.ts`: hushållsgrunddata, sökkatalog och deterministiska demoserier.
- `lib/energy.ts`: rena kostnads-, prognos-, besparings-, tids- och laddplaneringsfunktioner.
- `lib/adapters.ts`: kontrakt för mät- och prisadaptrar. Inga overifierade API-anrop.
- `tests/`: beräkningstester och Playwright-flöden för mobil och desktop.

Lokal hushållsdata indexeras efter ID i en gemensam demo-store. Tidsstämplar använder UTC ISO-strängar och presenteras i Europe/Stockholm. Genererade grafer är illustrationer. I framtida verklig drift måste alla aggregat hämtas från samma normaliserade mätdata.

## Fas 2: ännu inte implementerad

Inför Supabase/PostgreSQL med Auth och migrerade tabeller. Knyt auth.uid() till medlemskap. Aktivera RLS på varje hushållstabell med medlemskapskontroll vid varje läsning och rollkontroll vid ändring. Inbjudningar ska ha tidsbegränsade engångstoken och accepteras serverbaserat av korrekt identitet. Ägare och administratörer hanterar medlemmar, medlemmar kan utföra uttryckligen tillåtna åtgärder, läsbehöriga får endast läsa. Tillåt inte en administratör att höja sig över ägaren. Testa korshushållsläsningar och ändringar, rollbyten, återkallade medlemskap och manipulation av household-ID före lansering.

Fordon måste få normaliserad drivlinetyp och en verifierad, källhänvisad katalog för modellgeneration/variant/årsmodell. Nuvarande variant är fri text. Domänmodellerna är förberedelser och utgör inte produktionsdatabas eller migrationsfiler.

## Fas 3: inga verkliga integrationer

Prisleverantörens licens, kvartsupplösning, publiceringstid och tidszonsregler verifieras först. Lägg externa API-anrop i server-only-moduler, med Zod-validering och explicit källa/färskhet. Hushållsbehörighet måste kontrolleras innan varje anrop. Integrationstoken får endast hanteras på servern.

För Power Hub kan en lokal gateway behövas: utgående HTTPS, enhetsspecifik autentisering, validerade sekvensnummer/tidsstämplar, lokal kö, begränsad återleverans med backoff och deduplicering. Ingen inkommande portöppning. Detta är ett arkitekturförslag, inte verifierat protokoll.

Mätserier bör partitioneras efter tid och indexeras på household_id och timestamp. Föraggregera kvarts-, tim- och dygnsvärden för lätta diagram; behåll källmetadata och datakvalitet.

## Fas 4: innan styrning tillåts

Separera optimeringsförslag från kommandoutförande. Kräv uttryckligt aktiverad styrning, manuellt åsidosättande, exklusivt ägarskap av schemaläggning, kommandobegränsning, tillverkarens driftgränser och auditlogg. Fel/offline ska ge säkert standardläge och larm. Poolmodellen måste kalibreras mot värmeförlust och komfort. Golvvärme byggs först efter verifierad kompatibilitet och säkerhetsanalys. Notifikationer, riktig sparanalys och prognosmodeller återstår.

## SmartControl i den lokala demonstrationen

`lib/smart-control.ts` innehåller Zod-schemat och övergångarna för husets val av pool/billaddare. Inställningen är knuten till `Household.smartControl`, med endast `mode: demo`, valda kategorier, aktivt läge och UTC-tid för senaste ändring. Äldre hushåll utan inställningen får en avstängd standard. Ogiltiga sparade kategorier, dubbletter, anslutet läge och aktivt läge utan val avvisas.

`components/smart-control.tsx` använder en native dialog med fokusfälla, Escape och bekräftad lagring. Poolens smartläge och laddningens tidigare smartflagga synkroniseras genom `applySmartControl`. Paus behåller valen och stänger av simulerad optimering. Manuell laddstatus, temperaturmål och separata hushåll bevaras. Detta är en inställningssimulering, inte en bakgrundsscheduler eller en implementerad hårdvarustyrmotor. Verklig aktivering kräver fortfarande fas 2–4:s serverbehörigheter, verifierade integrationer och driftsskydd.

## Levande hushållssimulering och enhetsregistrering

`lib/simulation/engine.ts` är en ren, deterministisk modell för en svensk familj (standard: två vuxna, två barn). `use-simulation.ts` hämtar dagens och morgondagens validerade publika priser, uppdaterar aktuell tid var femte sekund och kastar bort för gamla prisunderlag. Hushålls-ID, valt område och svensk kalender styr modellen. Inga simulerade spotpriser används som fallback.

Den aktuella familjemodellen återspelar svensk midnatt till nu med nuvarande regler. Vid regeländring räknas hela modellkörningen om. Den är inte persistent avläsningshistorik eller en bakgrundsprocess. Förbrukningsvariation, grundvärme, dagliga enhetsbehov och bilens hemmatider är dokumenterade antaganden. Lastutrymme för flexibla enheter begränsas av säkringen. Poolens termiska komfort och minsta tillåtna verkliga driftcykler är inte verifierade; modellen får inte användas som fysisk styrmotor.

`evaluateRule` kräver aktuell kvart. Fast gräns jämför spotpris direkt. Procentregeln kräver sammanhängande data för exakt 24 förflutna timmar från nu, också vid DST. Den pausar vid pris ≥ procent × högsta pris; om högsta pris är ≤ 0 skapas ingen positiv prispaus. För saknat underlag används vänteläge. Paus, uppnått behov, utanför drifttid och manuell start är separata statusar.

Kostnad integreras per kvart med samma verkliga pris och modellerade kWh. Baslasten är identisk i normal-/smartjämförelsen. Ekonomisk prisskillnad normaliseras per enhet till samma levererade energi, så uppskjutet eller otillgodosett behov inte kallas besparing. Fasta månadsavgifter ingår inte i driftjämförelsen. Historiska månadsserier kräver faktisk prislagring och ligger utanför dagens modell.

`lib/devices.ts` validerar enhetstyp, modell och ett icke-hemligt serienummer/enhets-ID samt stoppar dubbletter inom hushållet. Guiden sparar `source: registered` och status Förberedd – ej ansluten. Den ändrar inte smartläge, utför inga anslutningstester och tar inte emot hemligheter. Äldre demoenheter visas fortsatt som demo. Verklig autentisering, synkronisering mellan webbläsare och hårdvaruintegrationer kräver framtida backend.
