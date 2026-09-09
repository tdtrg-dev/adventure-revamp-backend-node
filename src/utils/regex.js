// Escapes regex metacharacters in user-supplied search text before it reaches a
// MongoDB $regex query — an unescaped pattern (e.g. "(a+)+$") is both a query
// error waiting to happen and a ReDoS vector against the database.
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
