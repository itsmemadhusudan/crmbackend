function getBranchId(user) {
  if (!user) return null;
  if (user.role === 'admin') return null;
  const branch = user.branchId;
  return branch && (branch._id || branch) ? (branch._id || branch) : null;
}

function branchFilter(user) {
  const bid = getBranchId(user);
  if (bid == null) return {};
  return { branchId: bid };
}

function branchFilterForLead(user) {
  const bid = getBranchId(user);
  if (bid == null) return {};
  return { branchId: bid };
}

module.exports = { getBranchId, branchFilter, branchFilterForLead };
