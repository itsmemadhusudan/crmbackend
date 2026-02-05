function getBranchId(user) {
  if (!user) return null;
  if (user.role === 'admin') return null;
  const branch = user.branchId;
  return branch && (branch._id || branch) ? (branch._id || branch) : null;
}

/** Filter that matches no documents (for vendor with no branch assigned) */
const NO_BRANCH_FILTER = { _id: { $in: [] } };

function branchFilter(user) {
  const bid = getBranchId(user);
  if (bid == null) {
    if (user && user.role === 'vendor') return NO_BRANCH_FILTER;
    return {};
  }
  return { branchId: bid };
}

function branchFilterForLead(user) {
  const bid = getBranchId(user);
  if (bid == null) {
    if (user && user.role === 'vendor') return NO_BRANCH_FILTER;
    return {};
  }
  return { branchId: bid };
}

module.exports = { getBranchId, branchFilter, branchFilterForLead };
