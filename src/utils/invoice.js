const Counter = require('../models/Counter');

/** Mirrors "TKT-2026-000001" / "INV-2026-000001" style invoice numbers. */
async function nextInvoiceNumber(prefix) {
  const year = new Date().getFullYear();
  const key = `${prefix}-${year}`;

  const counter = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, new: true });

  return `${prefix}-${year}-${String(counter.seq).padStart(6, '0')}`;
}

module.exports = { nextInvoiceNumber };
