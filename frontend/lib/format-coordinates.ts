export function formatCoordinateParts(latitude: number, longitude: number, precision = 4) {
  return {
    latitude: `${Math.abs(latitude).toFixed(precision)}° ${latitude < 0 ? "S" : "N"}`,
    longitude: `${Math.abs(longitude).toFixed(precision)}° ${longitude < 0 ? "W" : "E"}`,
  };
}

export function formatCoordinates(latitude: number, longitude: number, precision = 4) {
  const parts = formatCoordinateParts(latitude, longitude, precision);
  return `${parts.latitude}, ${parts.longitude}`;
}
