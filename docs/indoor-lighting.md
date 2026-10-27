# Inomhusbelysning och Plejd

Belysning finns i vänstermenyn med Inomhus och Utomhus. Poolbelysning ligger under Utomhus. De befintliga utomhusgrupperna använder samma manuella/solstyrda bildläge som på Översikt, och manuella val lämnar endast den valda gruppens solstyrning.

Inomhus omfattar fyra namngivna fönstergrupper: 3 + 3 + 2 + 2 = 10 spottar. Varje grupp har ett eget förhandsläge. Bildens Inomhus-knapp tänder/släcker alla fyra, och visar Delvis när bara några grupper lyser. Ljuset klipps till fyra fönsterregioner i det sparade originalfotot. Placeringen är en bildtolkning av användarens beskrivning, inte verifierade armaturpositioner eller en kamerabild. Ljuslagret saknar träffytor och hovringsreglage. Originalfotot ändras inte.

Användaren tror att den befintliga Plejd-installationen är ansluten via Bluetooth; exakt brygga är ännu okänd. Sidan erbjuder därför Bluetooth / brygga ej vald som anslutningsval och sparar enbart icke-hemliga gruppreferenser. Dessa räknas inte som en anslutning. Inga kommandon skickas och inga observerade enhetsstatusar uppfinns. Riktig styrning behöver en identifierad kompatibel lokal brygga, autentiserad servertransport och bekräftad enhetsstatus. Browser-Bluetooth eller ett påhittat Plejd-API används inte. Befintlig `UnconfiguredPlejdAdapter` fortsätter rapportera not-configured.

Lägen och referenser sparas per hushåll i samma lokala lagring som tidigare belysning. Äldre data utan inomhusfält behåller sina sparade utomhusinställningar, och inomhus startar släckt. Detta ger inte lagring mellan olika Vercel-adresser eller flera användare/enheter.
