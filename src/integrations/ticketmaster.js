const axios = require('axios');
const env = require('../config/env');

/**
 * Mirrors TicketmasterService — normalizes Ticketmaster Discovery API results
 * into the same event shape our own events use. Fully fail-safe: disabled,
 * missing key, or any request failure all resolve to [] so an outage here can
 * never break the homepage/search (matches the "third-party clients fail
 * soft" pattern used throughout this backend).
 */
function isEnabled() {
  return env.ticketmaster.enabled && !!env.ticketmaster.apiKey;
}

function bestImage(event) {
  const images = event.images || [];
  if (images.length === 0) return null;
  const wide = images.find((i) => i.ratio === '16_9');
  return (wide || images[0])?.url || null;
}

function venueName(venue) {
  const parts = [venue?.name, venue?.city?.name].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function startingPrice(event) {
  const min = event.priceRanges?.[0]?.min;
  if (min === undefined || min === null) return 'Free';
  return Number(min) > 0 ? Number(min).toFixed(2) : 'Free';
}

function distanceKm(userLat, userLng, lat, lng) {
  if (userLat === null || userLng === null || lat === null || lng === null || userLat === undefined || userLng === undefined) return null;
  const R = 6371;
  const dLat = ((lat - userLat) * Math.PI) / 180;
  const dLng = ((lng - userLng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((userLat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function normalize(event, userLat, userLng) {
  const venue = event._embedded?.venues?.[0] || {};
  const lat = venue.location?.latitude !== undefined ? Number(venue.location.latitude) : null;
  const lng = venue.location?.longitude !== undefined ? Number(venue.location.longitude) : null;
  const externalId = event.id;
  if (!externalId) return null;

  return {
    event_id: null,
    source: 'ticketmaster',
    external_id: `tm_${externalId}`,
    booking_url: event.url || null,
    event_name: event.name || null,
    event_image: bestImage(event),
    description: event.info || event.pleaseNote || null,
    start_date: event.dates?.start?.localDate || null,
    end_date: event.dates?.end?.localDate || event.dates?.start?.localDate || null,
    location: venueName(venue),
    location_lat: lat,
    location_long: lng,
    distance_km: distanceKm(userLat, userLng, lat, lng),
    starting_price: startingPrice(event),
    rating: { avg: 0, count: 0 },
    interests: [],
    is_favt: false,
    favt_id: null,
  };
}

function isoDate(dateStr, time) {
  try {
    return `${new Date(dateStr).toISOString().slice(0, 10)}T${time}Z`;
  } catch {
    return null;
  }
}

async function search(lat, lng, radiusKm, size = 20, filters = {}) {
  if (!isEnabled()) return [];

  const params = { apikey: env.ticketmaster.apiKey, size: Math.min(200, Math.max(1, size)), sort: 'date,asc' };
  if (lat !== null && lat !== undefined && lng !== null && lng !== undefined) {
    params.latlong = `${lat},${lng}`;
    params.radius = Math.max(1, radiusKm);
    params.unit = 'km';
  }
  if (filters.keyword) params.keyword = filters.keyword;
  if (filters.start_date) params.startDateTime = isoDate(filters.start_date, '00:00:00');
  if (filters.end_date) params.endDateTime = isoDate(filters.end_date, '23:59:59');

  try {
    const { data } = await axios.get('https://app.ticketmaster.com/discovery/v2/events.json', { params, timeout: 6000 });
    const events = data?._embedded?.events || [];
    return events.map((e) => normalize(e, lat, lng)).filter(Boolean);
  } catch (e) {
    console.error('Ticketmaster search failed:', e.message);
    return [];
  }
}

function searchNearby(lat, lng, radiusKm, size = 20) {
  return search(lat, lng, radiusKm, size);
}

module.exports = { search, searchNearby };
