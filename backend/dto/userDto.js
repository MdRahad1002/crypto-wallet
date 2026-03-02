function toPublicUser(user) {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    role: user.role,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt
  };
}

function toAdminListUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isAdmin: user.isAdmin,
    walletsCount: user.wallets?.length || 0,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt
  };
}

function toUserDetails(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isAdmin: user.isAdmin,
    wallets: user.wallets,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt
  };
}

module.exports = {
  toPublicUser,
  toAdminListUser,
  toUserDetails
};
