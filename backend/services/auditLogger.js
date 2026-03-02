/**
 * Audit Logger Service
 * Handles security audit logging for sensitive operations
 * Ensures non-blocking event recording
 */

const AuditLog = require('../models/AuditLog');
const { DatabaseService } = require('./BaseService');

/**
 * AuditLoggerService - Manages audit trail for security events
 */
class AuditLoggerService extends DatabaseService {
  constructor() {
    super('AuditLogger', AuditLog);
  }

  /**
   * Log security event
   * Non-blocking: errors don't block request flow
   */
  async logEvent({
    actorType,
    actorId = null,
    action,
    targetUserId = null,
    targetWalletId = null,
    network = null,
    ip,
    userAgent,
    success = true,
    details = {}
  }) {
    try {
      this.validateRequired(
        { actorType, action, ip },
        ['actorType', 'action', 'ip']
      );

      const eventData = {
        actorType,
        actorId,
        action,
        targetUserId,
        targetWalletId,
        network,
        ip,
        userAgent,
        success,
        details,
        timestamp: new Date()
      };

      // Fire and forget - don't wait for DB
      this.create(eventData).catch(err => {
        this.log('error', 'logEvent_failed', {
          action,
          errorMessage: err.message
        });
      });

      return true;
    } catch (error) {
      // Log validation errors but don't throw
      this.log('error', 'logEvent_validation_error', {
        errorMessage: error.message
      });
      return false;
    }
  }

  /**
   * Query audit logs with filters
   */
  async queryLogs(filters = {}, options = { limit: 100 }) {
    return this.executeWithTracking('queryLogs', async () => {
      return this.find(filters, options);
    });
  }

  /**
   * Get logs for user
   */
  async getLogsForUser(userId, limit = 50) {
    return this.queryLogs(
      { $or: [{ actorId: userId }, { targetUserId: userId }] },
      { limit, sort: { timestamp: -1 } }
    );
  }

  /**
   * Get logs for action
   */
  async getLogsForAction(action, limit = 100) {
    return this.queryLogs(
      { action },
      { limit, sort: { timestamp: -1 } }
    );
  }

  /**
   * Get failed attempts
   */
  async getFailedAttempts(filters = {}, limit = 50) {
    return this.queryLogs(
      { ...filters, success: false },
      { limit, sort: { timestamp: -1 } }
    );
  }

  /**
   * Get suspicious activities
   */
  async getSuspiciousActivities(limit = 50) {
    return this.executeWithTracking('getSuspiciousActivities', async () => {
      const failedAttempts = await this.getFailedAttempts({}, limit);
      const multipleFailures = failedAttempts.filter(log =>
        log.details.attemptCount > 3
      );
      return multipleFailures;
    });
  }
}

// Export singleton instance
const auditLogger = new AuditLoggerService();

module.exports = {
  logEvent: (data) => auditLogger.logEvent(data),
  queryLogs: (filters, options) => auditLogger.queryLogs(filters, options),
  getLogsForUser: (userId, limit) => auditLogger.getLogsForUser(userId, limit),
  getLogsForAction: (action, limit) => auditLogger.getLogsForAction(action, limit),
  getFailedAttempts: (filters, limit) => auditLogger.getFailedAttempts(filters, limit),
  getSuspiciousActivities: (limit) => auditLogger.getSuspiciousActivities(limit),
  // Export instance for advanced usage
  instance: auditLogger
};
