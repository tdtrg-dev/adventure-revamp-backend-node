/** Great-circle distance in km (Haversine formula) — mirrors EventRepository::haversineDistance. */
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Minimum distance (km) from a point to a line segment — mirrors distanceFromPointToLineSegment. */
function distanceFromPointToLineSegment(pointLat, pointLng, startLat, startLng, endLat, endLng) {
  if (startLat === endLat && startLng === endLng) {
    return haversineDistanceKm(pointLat, pointLng, startLat, startLng);
  }

  const dx = endLng - startLng;
  const dy = endLat - startLat;
  const px = pointLng - startLng;
  const py = pointLat - startLat;

  const dotProduct = px * dx + py * dy;
  const lineLengthSq = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, dotProduct / lineLengthSq));

  const closestLat = startLat + t * dy;
  const closestLng = startLng + t * dx;

  return haversineDistanceKm(pointLat, pointLng, closestLat, closestLng);
}

module.exports = { haversineDistanceKm, distanceFromPointToLineSegment };
