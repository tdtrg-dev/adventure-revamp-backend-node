const Interest = require('../models/Interest');
const User = require('../models/User');

function formatSingle(interest, children) {
  return {
    id: interest.id,
    title: interest.title,
    image: interest.image,
    children: children.map((c) => ({ id: c.id, title: c.title, image: c.image })),
  };
}

async function getAllInterest(interestId) {
  if (interestId) {
    const interest = await Interest.findOne({ _id: interestId, parent_id: null });
    if (!interest) {
      const err = new Error('Interest not found.');
      err.statusCode = 400;
      throw err;
    }
    const children = await Interest.find({ parent_id: interest._id }).select('title image');
    return [formatSingle(interest, children)];
  }

  const parents = await Interest.find({ parent_id: null }).sort({ _id: 1 });
  if (parents.length === 0) {
    const err = new Error('No interests found.');
    err.statusCode = 400;
    throw err;
  }

  const allChildren = await Interest.find({ parent_id: { $in: parents.map((p) => p._id) } }).select('title image parent_id');
  const childrenByParent = new Map();
  allChildren.forEach((c) => {
    const key = String(c.parent_id);
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(c);
  });

  return parents.map((p) => formatSingle(p, childrenByParent.get(String(p._id)) || []));
}

/** Mirrors saveUserInterest's diff (add new, remove missing) + count summary. */
async function saveUserInterest(userId, interestIds) {
  const count = await Interest.countDocuments({ _id: { $in: interestIds } });
  if (count !== new Set(interestIds).size) {
    const err = new Error('One or more interests do not exist');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findById(userId).select('interests');
  const existingIds = user.interests.map(String);
  const incomingIds = [...new Set(interestIds.map(String))];

  const added = incomingIds.filter((id) => !existingIds.includes(id)).length;
  const removed = existingIds.filter((id) => !incomingIds.includes(id)).length;

  await User.updateOne({ _id: userId }, { interests: incomingIds });

  return { user_id: userId, interest_ids: incomingIds, added, removed };
}

module.exports = { getAllInterest, saveUserInterest };
