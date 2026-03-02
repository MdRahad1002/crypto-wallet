const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, '..', 'logs', 'admin-actions.log');

function logAdminAction({ userId, action, targetId, metadata, ip }) {
  const entry = {
    timestamp: new Date().toISOString(),
    userId,
    action,
    targetId,
    ip,
    metadata
  };

  fs.appendFile(logPath, `${JSON.stringify(entry)}\n`, (error) => {
    if (error) {
      console.error('Failed to write admin audit log:', error);
    }
  });
}

module.exports = {
  logAdminAction
};
