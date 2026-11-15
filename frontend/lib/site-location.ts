import type { Site } from "../app/types";
import { formatCoordinates } from "./format-coordinates";
import { referenceSites } from "./reference-sites";

const radians = Math.PI / 180;
const directions = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
const placeholder = /^(?:custom location|custom comparison point)$/i;
const generatedPoint = /^(?:candidate|backup terrain candidate|terrain comparison point|nearby comparison point|rejected terrain point) \d+(?:\.\d+)?°\s*\/\s*\d+(?:\.\d+)? m$/i;

export const comparisonRadiusKm = 20;
export function comparisonDistanceKm(first: Site, candidate: Site) {
  const latitude = first.latitude * radians;
  const otherLatitude = candidate.latitude * radians;
  const halfLongitudeDifference = (candidate.longitude - first.longitude) * radians / 2;
  const haversine = Math.sin((otherLatitude - latitude) / 2) ** 2
    + Math.cos(latitude) * Math.cos(otherLatitude) * Math.sin(halfLongitudeDifference) ** 2;
  return 2 * 1737.4 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function meaningfulName(site?: Site) {
  const name = site?.name.trim();
  if (!name || placeholder.test(name) || generatedPoint.test(name) ||
      /^\d+(?:\.\d+)? km \w+ of (?:custom location|custom comparison point)$/i.test(name)) return undefined;
  return name;
}

export function siteLocationName(site: Site, centre?: Site): string {
  // Area assessments already store names in this format when the centre is named.
  const storedName = meaningfulName(site);
  if (storedName) return storedName;
  if (!Number.isFinite(site.latitude) || !Number.isFinite(site.longitude)) return "Coordinates unavailable";

  const centreName = meaningfulName(centre);
  let reference = centre && centreName && Number.isFinite(centre.latitude) && Number.isFinite(centre.longitude)
    ? { name: centreName, point: centre, distance: comparisonDistanceKm(centre, site) }
    : undefined;
  if (!reference) {
    // Use an existing catalogue site only when it is within the local comparison range.
    for (const point of referenceSites) {
      const distance = comparisonDistanceKm(point, site);
      if (distance <= comparisonRadiusKm && (!reference || distance < reference.distance)) {
        reference = { name: point.name, point, distance };
      }
    }
  }
  if (!reference) return formatCoordinates(site.latitude, site.longitude);
  if (reference.distance < 0.000001) return reference.name;

  const fromLatitude = reference.point.latitude * radians;
  const toLatitude = site.latitude * radians;
  const longitudeDelta = (site.longitude - reference.point.longitude) * radians;
  const bearing = Math.atan2(
    Math.sin(longitudeDelta) * Math.cos(toLatitude),
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
      Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta),
  ) / radians;
  const direction = directions[Math.round((bearing + 360) / 45) % directions.length];
  const distance = Number(reference.distance.toFixed(reference.distance < 0.005 ? 6 : 2));
  return `${distance} km ${direction} of ${reference.name}`;
}
