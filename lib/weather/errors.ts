export const weatherErrors = {
  "postcode-not-found":
    "Postnumret finns inte i postnummertjänsten. Kontrollera de fem siffrorna.",
  "location-unavailable":
    "Postnummertjänsten kunde inte nås. Försök igen om en minut.",
  "location-invalid":
    "Postnummertjänsten gav ingen giltig svensk plats för postnumret.",
  "forecast-unavailable":
    "Vädertjänsten MET Norway kunde inte nås. Försök igen om en minut.",
  "forecast-invalid":
    "MET Norway gav en ofullständig eller inaktuell prognos. Försök igen senare.",
} as const;
export type WeatherErrorCode = keyof typeof weatherErrors;
export class WeatherError extends Error {
  constructor(public code: WeatherErrorCode) {
    super(weatherErrors[code]);
  }
}
export function weatherErrorMessage(code: unknown) {
  return typeof code === "string" && Object.hasOwn(weatherErrors, code)
    ? weatherErrors[code as WeatherErrorCode]
    : null;
}
