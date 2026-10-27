# Husbild: väder, dagsljus och solstyrd belysning

## Foto och visualisering

Originalfotot ändras inte. CSS-färgton och ljusstyrka samt transparenta SVG-lager ger en **bildvisualisering**, inte en verklig kamerabild. Klockan visas i Europe/Stockholm med sekunder och följer sommar-/vintertid. Den uppdateras varje sekund medan fliken är synlig och direkt när den visas igen.

Årstidsfärger använder svensk kalender (vinter dec–feb, vår mars–maj, sommar juni–aug, höst sep–nov). Detta är en kalenderbaserad färgton, inte ett påstående om lokal meteorologisk årstid. Snö ritas endast när en aktuell MET-symbol anger snö/snöblandat regn, inte bara för att månaden är vinter. Regn, snö, moln, dimma och solvisualisering kommer från aktuell verifierad timprognos. Okänd eller inaktuell prognos skapar inga påhittade vädereffekter. Snöeffekten visar nederbörd, inte verifierat snödjup eller ackumulerad snö. Åska ger regn/mörkare ton men inga blinkande blixtar.

Dagsljus använder platsens latitud/longitud och en beräknad solhöjd med J2000-solkoordinater (SunCalc-formler), oberoende av prognosens dag/natt-suffix. Övergång mellan dag, låg sol, skymningsljus och natt sker gradvis utan fasta kl. 18–07-antaganden. Polarnatt och midnattssol följer samma solhöjd. En tidigare verifierad plats får användas även när väderprognosen blivit otillgänglig; postnummerbyte rensar kopplingen och återanvänder inte föregående plats. Saknas plats kan dagsljus/solstyrning inte beräknas. Bilden efterliknar inte förändringar i byggnadens faktiska skugggeometri.

Animerad nederbörd är dekorativ och ignorerar pekarhändelser. `prefers-reduced-motion` stänger av rörelsen och mjuka filterövergångar, men den statiska väderinformationen finns kvar.

## Lokal ljussättning och poollampa

Strålkastarkäglor och ritade armaturikoner är borttagna från ljuslagret. Radiala masker visar en lokalt uppljusad kopia av samma foto, så fasadens, häckens och markens textur bevaras. Ljuset har en varm ton. Hela fotot mörknas inte längre bara för att lamporna slås på; nattmörkret styrs av solhöjden.

Poollampan har eget av/på-läge och en egen träffpunkt/knapp i bilden samt ett reglage i Poolvyn. Den är placerad strax innanför långsidan närmast huset, referenskoordinat 650/973. Ljusmasken är blåtonad och klipps till poolens vattenyta. Den gör inga antaganden om installerad undervattensarmatur eller transformator. Ingen faktisk poollampa är ansluten.

## Smart styrning

I smartdialogen kan **Utebelysning** och **Poolbelysning** väljas var för sig. Poolbelysning visas visuellt som underkategori till Pool och kräver inte att poolvärmen också aktiveras. Äldre sparade val för Pool och Billaddare fortsätter fungera.

När en ljusgrupp är vald och huvudstyrningen aktiv följer **förhandsvisningen** beräknad solnedgång/soluppgång: tänd när solcentrum ligger under −0,833°, släckt när det når eller överstiger denna höjd. Gränsen inkluderar en standardapproximation för solskiva och atmosfärisk refraktion. Moln kan påverka bilden men får inte ändra detta av/på-villkor. Saknas en verifierad plats visas vänteläge och inget solläge gissas. Pausad huvudstyrning släcker den valda ljusgruppen i förhandsvisningen.

Ett uttryckligt manuellt av/på-val tar bort **bara den valda ljusgruppen** från smartstyrningen och sparar dess manuella förhandsläge. Övriga val, till exempel utomhusbelysning när poollampan ändras manuellt, bevaras.

Detta är ingen driftsatt solautomation för hårdvara: inga Plejd-kommandon skickas, och fliken behöver inte köra i bakgrunden för att nästa visning ska kunna beräkna rätt bildläge. En riktig, kontinuerlig automation kräver verifierad hårdvara, separata ute-/poolgrupper, en alltid tillgänglig server/brygga, behörighetskontroll och bekräftad status. Sparade bildval får inte skickas som gamla hårdvarukommandon när en framtida brygga ansluts.

## Tester

Enhetstester täcker solhöjd över årstider, polarnatt/midnattssol, saknad/inaktuell prognos, snö endast från väderdata samt separata ljusgruppers dag/natt-villkor. Webbläsartester täcker svensk klocka, regn/snö, texturbevarande ljuslager utan strålkäglor, natt→dag→natt, självständigt manuellt poolval och val av båda ljusgrupperna i smartdialogen utan poolvärme. Testprognoser används bara i tester; appen använder MET-data.

Poolen i referensfotot ligger enligt användaren i rakt västerläge (270°). Solvisualiseringens riktning använder därför beräknad solazimut: väster/kväll projiceras mot poolens sida i bildens nedre vänstra förgrund, öster/morgon mot husets baksida. Detta ändrar inte upp-/nedgångstid och inför ingen påhittad solvärmeenergi i poolmodellen.

Höger fasad ligger enligt användaren i söderläge (180°). Söder/middagsljus projiceras följaktligen mot bildens högra sida, i samma kompasskalibrering som poolens västerläge.

## Översiktens dygnsvy

Kategoriknapparna ligger inuti fotots vänsterkant. Ljusgruppernas gröna färg och texten Tänd följer faktiskt beräknat förhandsläge, oberoende av vilken kategori som hovras. Soluppgång och solnedgång beräknas för svensk kalenderdag och samma horisontgräns −0,833° som solstyrningen; vid polardag/natt uppfinns inga klockslag. Klockan får dagens prognos i åtta tretimmarsrutor (två rader på mobil). MET levererar framtida prognostimmar; passerade timmar som saknas ersätts inte med påhittad historik.

Postnummer och återhämtning av prognos finns direkt vid klockan, med samma hushållsinställning som väderpanelen. Sparade postnummer är fortfarande lokala per webbursprung; en ny Vercel-adress kan kräva postnumret igen. Ett misslyckat anrop visas här och kan göras om med samma postnummer. Klientens anrop avbryts efter 25 sekunder om nätverket hänger sig. Live-kontroll av produktions-API för 13250 samt MET/geokodning lyckades 2026-10-27; inga testvärden används i appen.
