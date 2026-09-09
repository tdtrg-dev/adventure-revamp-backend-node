const ParkStayLead = require('../models/ParkStayLead');
const { escapeRegex } = require('../utils/regex');

function fail(message, code = 400) {
  const err = new Error(message);
  err.statusCode = code;
  return err;
}

async function index({ type, status, search, page = 1, per_page = 20 }) {
  const query = {};
  if (type) query.type = type;
  if (status) query.status = status;
  if (search) {
    const safeSearch = escapeRegex(search);
    query.$or = [{ name: { $regex: safeSearch, $options: 'i' } }, { email: { $regex: safeSearch, $options: 'i' } }];
  }

  const [total, hosts, guests, newCount] = await Promise.all([
    ParkStayLead.countDocuments(query),
    ParkStayLead.countDocuments({ ...query, type: 'host' }),
    ParkStayLead.countDocuments({ ...query, type: 'guest' }),
    ParkStayLead.countDocuments({ ...query, status: 'new' }),
  ]);

  const leads = await ParkStayLead.find(query)
    .sort({ _id: -1 })
    .skip((page - 1) * per_page)
    .limit(per_page);

  return {
    summary: { total, hosts, guests, new: newCount },
    leads: { data: leads, current_page: page, per_page, total, last_page: Math.max(1, Math.ceil(total / per_page)) },
  };
}

async function updateStatus(id, status) {
  const lead = await ParkStayLead.findById(id);
  if (!lead) throw fail('Lead not found.', 404);
  lead.status = status;
  await lead.save();
  return lead;
}

module.exports = { index, updateStatus };
