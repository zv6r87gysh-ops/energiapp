# Utebelysning och förberedd Plejd-anslutning

## Funktion nu

Översikt har en tydligt märkt **förhandsvisning** med en av/på-knapp. Den tänder och släcker ett SVG-lager på det befintliga, lokalt lagrade husfotot. Originalfotot, dess IndexedDB-nycklar och övriga husmarkeringar ändras inte. Belysningen är schematisk och följer användarens röda markeringar: fyra downlights vid fasad/pergola, fyra markspots längs vänster gång/hedge, sex längs högra terrasskanten och sex längs den främre trädgårdskanten. Positionerna är normaliserade till det ursprungliga husfotots 1596 × 1422 koordinater, inte skärmbildens svarta marginaler eller macOS-verktygsfält.

Tänd förhandsvisning ger en varm, mjuk lokal uppljusning av fotots egen textur. Strålkäglor och armaturikoner är borttagna. Dagsljuset styrs separat av platsens solhöjd. Detta är en visuell illustration, inte en fysisk ljusberäkning eller information om solens aktuella läge. Släckt förhandsvisning tar bort ljuslagret. I viloläge visas fotot utan valda kategorier, markörknappar eller armaturpunkter. `prefers-reduced-motion` respekteras.

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

### Hovring och reglage i bilden

Hus-/poolkonturer, kategorietiketter och kostnader visas först vid hovring, tangentbordsfokus eller tryck och avmarkeras när pekaren lämnar. Hovring på någon av de 20 ljuspunkterna eller längs de markerade belysningsstråken öppnar ett gemensamt av/på-reglage inne i bildytan. Reglaget nås även via knappen Utebelysning under fotot på mobil och med tangentbord. Hovring öppnar endast reglaget; av/på kräver ett explicit klick/tryck. Den tända ljusförhandsvisningen förblir tänd även när reglaget stängs. Vänstersidans fyra markspots har flyttats 80 bildkoordinater in mot gången, till insidan av häcken. Originalfotot och sparade Plejd-referenser bevaras.

### Liten smartstyrningsruta och bild mellan förhandsversioner

Smartstyrningen är nu en liten ruta i bildens övre högra hörn, även på mobil. Vänstersidans markspots är ytterligare flyttade mot gången (45 bildkoordinater åt höger), och träffområdet följer samma placering.

IndexedDB är bundet till webbplatsens ursprung: en ny Vercel-förhandsadress kan inte läsa fotot från en annan adress. För att kunna leverera samma standardfoto i alla nya byggen finns nu `public/house-photo.json`. När originalfilen kan läggas i `public/`, ange dess sökväg i manifestets `url`. `householdId` begränsar vilket hushåll standardbilden gäller. Originalbilden från användarens ZIP-fil finns nu oförändrad i `public/images/house-photo.jpg` och manifestet är aktiverat. Standardbilden levereras därför med varje bygge och kräver inte lokal webbläsarlagring.

Lokalt valt foto har företräde och dess lagring ändras inte. Saknas lokal bild används den inbyggda bilden om manifestet innehåller en giltig rot-relativ JPG/PNG/WebP-sökväg för valt hushåll. Utländska URL:er och andra hushåll avvisas. Tester täcker både lokalt sparad bild och en inbyggd bild i en ny webbläsarsession utan tidigare lagring.

Originalfilen är 1448 × 1086 och har ett bredare utsnitt än den första chattbilden (1596 × 1422). `lib/house-photo-layout.ts` anpassar därför SVG-vy, markörer och hovringsrutor för originalbilden. Samma kalibrering används för huskonturer, ljuseffekter och belysningens träffområden. Uppladdade äldre beskärningar behåller sitt tidigare koordinatsystem.

Vänstersidans fyra ljuspunkter är nu placerade längs häckens mittlinje i originalfotot, bort från gångens poolkant. Förhandsvisningens träffområde följer samma fyra positioner. Placeringen har kontrollerats visuellt på den inbyggda originalbilden.

Utebelysningen och den separata poollampan kan nu väljas för solstyrd förhandsvisning i smartdialogen. Klocka, väder och årstidsvisualisering samt manuella överstyrningar beskrivs i [house-atmosphere.md](house-atmosphere.md). Verklig hårdvarustyrning är fortfarande inte ansluten.
