# Hårdvaruintegrationer

| Integration                      | Status                    | Krävs före verklig anslutning                                                                                          |
| -------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Svenska kvartspriser             | Aktiv · Elprisetjustnu.se | Verifierat 2026-10-21; se electricity-prices.md                                                                        |
| Zaptec                           | Ej ansluten               | Officiell API-dokumentation, serverautentisering, rättighetskontroll, konfliktskydd och auditlogg                      |
| Zaptec Sense P1                  | Ej installerad            | Bekräftad KM-kompatibilitet och installation; ingen aktiv lastbalansering antas                                        |
| Boo Energi Power Hub KM / Bitvis | Planerad                  | Verifierat protokoll, datafält och eventuell lokal gateway                                                             |
| Pahlén Calidi VP                 | WiFi planerad             | Bekräftat API, mätstöd, säkra driftgränser; annars extern energimätare                                                 |
| Plejd / Utebelysning             | Förberedd, ej ansluten    | Vald kompatibel brygga, autentiserad adapter och bekräftad av/på-status; se [outdoor-lighting.md](outdoor-lighting.md) |
| Thermotech EC8 / Qvantum         | Ej ansluten               | Verifierad kompatibilitet; inga aktiva styrreglage i fas 1                                                             |

Publik elprisläsning är verifierad och implementerad. Ingen hårdvaruintegration är ansluten. Home Assistant är inte ett krav. Guiden för egna enheter sparar endast modell och icke-hemligt enhets-ID lokalt. Den gör inga anslutningstester och visar alltid Förberedd – ej ansluten tills en verifierad hårdvaruintegration finns.
