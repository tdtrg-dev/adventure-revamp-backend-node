// Mirrors Eloquent's default JSON serialization: `date:Y-m-d` casts (dateOnly)
// vs. the default `datetime` cast (datetimeStr, 'Y-m-d H:i:s') — never the raw
// Mongoose Date's full ISO timestamp.
function dateOnly(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : null;
}

function datetimeStr(d) {
  return d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) : null;
}

const UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

// Approximates Carbon's default diffForHumans() ('2 hours ago' / '3 days from now') —
// used wherever Laravel calls it directly in a repository response.
function diffForHumans(date, from = new Date()) {
  if (!date) return null;
  const diffMs = from.getTime() - new Date(date).getTime();
  const isFuture = diffMs < 0;
  const diffSec = Math.round(Math.abs(diffMs) / 1000);

  let value = diffSec;
  let unit = 'second';
  for (const [u, secs] of UNITS) {
    if (diffSec >= secs) {
      value = Math.floor(diffSec / secs);
      unit = u;
      break;
    }
  }

  const plural = value === 1 ? unit : `${unit}s`;
  return isFuture ? `${value} ${plural} from now` : `${value} ${plural} ago`;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Mirrors Carbon's ->format('d M, Y') (e.g. '05 Jan, 2027') used on a few dashboard fields.
function dayMonthYear(d) {
  if (!d) return null;
  const date = new Date(d);
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${day} ${SHORT_MONTHS[date.getUTCMonth()]}, ${date.getUTCFullYear()}`;
}

module.exports = { dateOnly, datetimeStr, diffForHumans, dayMonthYear };
