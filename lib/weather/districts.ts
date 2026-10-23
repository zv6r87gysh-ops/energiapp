import { z } from "zod";
import districts from "./postal-districts.json";
import type { WeatherLocation } from "./contracts";
// GeoNames via zauberware, snapshot b4be5a6e3c30c65dc7846e09ec9b70d65d0db7f5, CC BY 4.0.
// Retain only districts with >=3 listed postcodes sharing exactly the same place and coordinates.
// This is an explicitly labelled area forecast, not validation of an unlisted postcode.
const points = z
  .record(
    z.string().regex(/^\d{3}$/),
    z.tuple([
      z.string().min(1),
      z.number().min(55).max(70),
      z.number().min(10).max(25),
    ]),
  )
  .parse(districts);
export function districtLocation(postcode: string): WeatherLocation | null {
  const prefix = postcode.slice(0, 3);
  const point = points[prefix];
  if (!point) return null;
  return {
    postcode,
    place: point[0],
    latitude: point[1],
    longitude: point[2],
    locationPrecision: "district",
    locationArea: `${prefix}xx`,
    locationSource: "GeoNames",
  };
}
