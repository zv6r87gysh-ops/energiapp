# Liggande iPad och stämningsknappar via molnet

Översikten visar husfotot och en separat musikpanel bredvid varandra på liggande iPad (1024–1400 px bredd). Bilden behåller sitt naturliga format och koordinater. Huvudmenyn öppnas med menyknappen så att huset får mer utrymme. Klocka, soluppgång/solnedgång, aktuell verifierad spotpriskvart och kommande 24 timmars väder ligger i en kompakt rad ovanför fotot. Bilden skalas proportionellt mot tillgänglig skärmhöjd för att huset, väder, tid, pris och musik ska synas samtidigt utan scroll i 1024×768 och 1366×1024. Övriga energidetaljer finns längre ned på sidan. Spotpris använder den redan validerade levande prisadaptern och visar området samt exklusive moms/avgifter. Saknat pris får inte ersättas med demodata. Musikknapparna fungerar med tryck, inte hovring. Telefon/porträtt har en staplad reservlayout. PWA-manifestet begär liggande läge; Safari/iPadOS kan ignorera orienteringsönskemålet, så fysisk rotation/rotationslås kan fortfarande behövas.

Tre redigerbara stilar finns: grön Barn, blå Lounge/chill och röd Stämning. Standard-sökorden är barnmusik svenska, lounge chill respektive soul jazz. Under Musik & stämningar i Inställningar sparas musikstil/sökord, volym, ljusnivå och vilka inomhusgrupper som ska ingå, per hushåll. Det finns inga fasta spelliste-ID:n i inställningarna.

## Vad musikanslutningen faktiskt gör

Ingen Home Assistant eller Raspberry Pi används för musiken. Två separata OAuth-inloggningar krävs:

1. **Sonos Control API** listar hem och rum/grupper, ändrar vald grupps volym och kan begära paus.
2. **Spotify Web API** söker efter spellistor utifrån musikstilens sökord, väljer slumpmässigt en av de giltiga träffarna och startar den med Spotify Connect på den valda enheten.

Sonos-inloggning ensam ger inte en verifierad generell genresökning/start av godtyckliga Spotify-spellistor. Därför finns den separata Spotify-anslutningen. Användaren väljer samma fysiska rum i Sonos-listan och Spotify Connect-listan; inga namn gissas ihop automatiskt. Om enheten inte syns behöver den väljas/aktiveras i Spotify och listan sedan uppdateras. Sonos behöver inte en särskild Raspberry Pi för detta. Båda tjänsterna och deras nätanslutning måste vara tillgängliga.

Spotify Premium och behörighet till utvecklarappen krävs för uppspelning. Appens kvoter/utvecklarläge och vilka konton som får använda den styrs även av Spotify. Sonos måste godkänna den registrerade Control-integrationen för de konton som används. API-begränsningar rapporteras som fel; appen påstår inte att uppspelning fungerar om tjänsten nekar den.

Sökningen sker på nytt vid varje aktivering (`type=playlist`, `limit=10`), inte på en hårdkodad eller lokal demokatalog. Nullposter, ogiltiga URI:er och dubbla resultat tas bort. Urval använder Node crypto.randomInt. Senast valda URI undviks om andra kandidater finns, som en kortlivad optimering per serverinstans. Sökord är inte verifierad genreklassificering av varje låt. Genren beror på tjänstens sökresultat och spellistornas innehåll. Ingen barnsäkerhets-/innehållsfiltrering påstås.

Volym sätts innan start. Om start sedan misslyckas visas att Sonos-volymen redan har ändrats. Det görs ingen automatisk återupprepning av startkommandon. Efter lyckad startbegäran läses Spotify-status tillbaka: endast om enhet, spellistekontext och is_playing stämmer rapporteras att Spotify visar uppspelning. Detta är tjänstens rapport, inte ett bevis på hörbart ljud. Om läsningen saknas blir status Start begärd.

Paus begär paus för det valda Sonos-rummet och återställer inte ljusnivåer. Knapparna spärras i gränssnittet medan en begäran pågår; servern har även ett tillfälligt per-hushållslås. Det är inte en distribuerad låsning eller en garanti om exakt-en-gång-leverans mellan flera serverinstanser.

## Belysning är fortfarande förhandsvisning

Plejd har ännu ingen verifierad fysisk anslutning. Stämningsknapparna ändrar därför bara de valda inomhusgruppernas ljusläge och ljusstyrka i husbilden. UI:t visar detta separat även om musiken är ansluten på riktigt. Utomhus/pool och övriga lampgrupper påverkas inte. Ingen Plejd-Gateway eller annan brygga antas fungera med Energihem utan en verifierad integrationsväg. Vid oanslutna musik-konton är knapparna uttryckligen Förhandsvisa och inga musikkommandon skickas.

## Aktivera inloggning på Vercel

Registrerade utvecklarappar krävs innan inloggning kan användas. Appen kan inte använda en godtycklig Sonos-/Spotify-inloggning utan egna klientnycklar.

1. Skapa en Sonos Control-integration på [Sonos Developer](https://developer.sonos.com/) och en Spotify-app på [Spotify Dashboard](https://developer.spotify.com/dashboard). Kontrollera tjänsternas aktuella konto-/publiceringskrav.
2. Registrera följande exakta Redirect URI:er (byt domän om en annan stabil miljö ska användas):
   - `https://energiapp-rho.vercel.app/api/music/callback?provider=sonos`
   - `https://energiapp-rho.vercel.app/api/music/callback?provider=spotify`
3. Lägg följande servervariabler i Vercels miljöinställningar och driftsätt igen:
   - `MUSIC_PUBLIC_ORIGIN=https://energiapp-rho.vercel.app`
   - `MUSIC_SESSION_SECRET`: minst 32 tecken, slumpmässig; generera till exempel med `openssl rand -hex 32`.
   - `SONOS_CLIENT_ID`, `SONOS_CLIENT_SECRET`
   - `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
4. Öppna Inställningar → Musik & stämningar på iPaden. Logga in hos Sonos och Spotify, välj rum och motsvarande Sonos-enhet i Spotify Connect, spara.
5. Prova först med låg volym. Kontrollera i Sonos/Spotify att rätt rum får musiken och att appens återrapporterade status stämmer.

Skicka inte nycklar, lösenord eller tokens i chatten och lägg dem inte i repo/localStorage eller NEXT_PUBLIC_-variabler. Sonos/Spotify-tokenutbytet görs på servern. Access-/refresh-tokens lagras i separata AES-256-GCM-krypterade, HttpOnly-cookies (Secure över HTTPS, SameSite=Lax). OAuth använder slumpmässigt state, tio minuters tillfällig cookie och Spotify PKCE. Kontrollanrop måste ha samma Origin och en giltig session bunden till aktuellt hushåll. Rummen/enheterna kontrolleras mot den inloggades aktuella listor före start. Ingen godtycklig tjänsteadress eller enhets-URL accepteras från klienten.

Cookies är lokala för webbläsaren och domänen. Ny Vercel-förhandsdomän behöver egen registrerad Redirect URI/origin och ny inloggning. Delad iPad-session ger den som använder iPaden kontroll över de anslutna musikkontona. Koppla från musik rensar appens lokala OAuth-cookies; återkalla även åtkomst hos respektive leverantör om fullständig återkallelse önskas. Bytt MUSIC_SESSION_SECRET gör befintliga sessioner ogiltiga. Ingen databas eller beständig tokenlagring mellan iPad-enheter är införd.

## Underlag och validering

Referenser: [Sonos Control API](https://docs.sonos.com/), [Spotify Authorization Code](https://developer.spotify.com/documentation/web-api/tutorials/code-flow), [Spotify Player](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback), [Spotify Search](https://developer.spotify.com/documentation/web-api/reference/search). OAuth-adresser/scopes verifierades även mot ett publicerat [Sonos Cloud-exempel](https://github.com/oncuehome/homebridge-sonos-cloud-doorbell/blob/main/scripts/authorize.js); Control-grupper, volym och paus mot paketet sonos-control 1.0.1 och Spotify Player mot det officiella TypeScript-SDK:t. Sonos senaste referenssida gick inte att läsa från denna miljö, så aktuell kontobehörighet/versionskompatibilitet behöver verifieras med faktiska konton.

Tester använder simulerade leverantörssvar och skickar inga kommandon till riktig hårdvara. De kontrollerar OAuth-state/PKCE, kryptering och sessionsgränser, saknade/ogiltiga enheter, genresökning, slumpurval utan omedelbar upprepning, delvis utförda kommandon, återrapportering samt liggande iPad-vy, tryckknappar och sparade stilar. Liveuppspelning är inte verifierad eftersom inga registrerade appnycklar eller auktoriserade konton finns i miljön.
