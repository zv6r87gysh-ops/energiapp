# Jarvis – designförhandsversion

Branch: `feat/jarvis-modern-dashboard`. Ändringarna ska granskas i en Preview innan eventuell merge till main. Ingen produktionspublicering ingår i den här ändringen.

Översikten har en större husillustration med anpassade klickytor, ljusmasker och lampplaceringar. På liggande iPad visas klocka, soltider och kostnad i en smal statusrad, åtta kommande väderslots, husbild till vänster och musik samt rullande prisgraf till höger. Ljust och mörkt tema väljs med sol-/månknappen och sparas som tidigare lokalt. Navigationen finns nederst och övriga vyer kan nås via menyn.

Illustrationen bygger på användarens foto och den godkända bildskissen, med öppen pool och undanplockad altan. Den är en visualisering; de inritade ljusen är inte bevis på verklig lampstatus. Plejd är fortfarande inte anslutet. Ursprungliga fotot finns kvar i `public/images/house-photo.jpg`. Ny standardbild ligger i `public/images/jarvis-house.webp`. Egna bilder i webbläsarens lagring prioriteras fortfarande; en ny Preview-domän använder den medföljande bilden utan uppladdning.

Priser, väder och Sonos använder samma leverantörer och API-rutter som tidigare. Inga exempelvärden har lagts till i produktflödet. Skärmbilder från automatiska tester använder testdata. Musikanslutning på en ny Preview-domän kräver att OAuth-konfiguration och tillåtna callback-adresser stöder den domänen; produktionscookies delas inte med Preview.

Layouten använder CSS subgrid (stöds i moderna Safari-versioner på iPad). På smalare skärmar ligger innehållet i en följd som går att scrolla. Behåll main för att avstå från designen, eller granska diffen och merga branchen när förhandsversionen är godkänd.
