/**
 * Prometheus-style metrics service for monitoring
 * Tracks request metrics, auth events, errors, and system health
 */

const os = require('os');

class MetricsService {
  constructor() {
    // HTTP metrics
    this.httpRequests = new Map(); // path -> { count, errors, totalDuration }
    this.httpStatusCodes = new Map(); // status -> count
    
    // Auth metrics
    this.authMetrics = {
      loginAttempts: 0,
      loginSuccesses: 0,
      loginFailures: 0,
      refreshTokens: 0,
      logouts: 0,
      tokenRevocations: 0,
      tokenBlacklist: 0
    };
    
    // Error metrics
    this.errorMetrics = {
      total: 0,
      byType: new Map() // error type -> count
    };
    
    // Business metrics
    this.businessMetrics = {
      walletsCreated: 0,
      transactionsSent: 0,
      walletRecoveries: 0,
      kycsSubmitted: 0,
      webhooksDispatched: 0
    };
    
    // System metrics (captured periodically)
    this.systemMetrics = {
      memoryUsage: 0,
      cpuUsage: 0,
      uptime: 0,
      mongodbConnected: false
    };
    
    this.startTime = Date.now();
  }

  /**
   * Record HTTP request metric
   */
  recordRequest(method, path, statusCode, durationMs) {
    const key = `${method} ${path}`;
    
    if (!this.httpRequests.has(key)) {
      this.httpRequests.set(key, { count: 0, errors: 0, totalDuration: 0 });
    }
    
    const metric = this.httpRequests.get(key);
    metric.count++;
    metric.totalDuration += durationMs;
    if (statusCode >= 400) {
      metric.errors++;
    }
    
    // Track status code
    this.httpStatusCodes.set(statusCode, (this.httpStatusCodes.get(statusCode) || 0) + 1);
  }

  /**
   * Record authentication event
   */
  recordAuthEvent(eventType, success = true) {
    switch (eventType) {
      case 'login':
        this.authMetrics.loginAttempts++;
        if (success) {
          this.authMetrics.loginSuccesses++;
        } else {
          this.authMetrics.loginFailures++;
        }
        break;
      case 'refresh':
        this.authMetrics.refreshTokens++;
        break;
      case 'logout':
        this.authMetrics.logouts++;
        break;
      case 'revoke':
        this.authMetrics.tokenRevocations++;
        break;
      case 'blacklist':
        this.authMetrics.tokenBlacklist++;
        break;
    }
  }

  /**
   * Record error metric
   */
  recordError(errorType, count = 1) {
    this.errorMetrics.total += count;
    this.errorMetrics.byType.set(errorType, (this.errorMetrics.byType.get(errorType) || 0) + count);
  }

  /**
   * Record business event
   */
  recordBusinessEvent(eventType, count = 1) {
    switch (eventType) {
      case 'wallet_created':
        this.businessMetrics.walletsCreated += count;
        break;
      case 'transaction_sent':
        this.businessMetrics.transactionsSent += count;
        break;
      case 'wallet_recovery':
        this.businessMetrics.walletRecoveries += count;
        break;
      case 'kyc_submitted':
        this.businessMetrics.kycsSubmitted += count;
        break;
      case 'webhook_dispatched':
        this.businessMetrics.webhooksDispatched += count;
        break;
    }
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics(mongodbConnected) {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    this.systemMetrics.memoryUsage = Math.round((usedMemory / totalMemory) * 100);
    this.systemMetrics.uptime = Math.floor((Date.now() - this.startTime) / 1000);
    this.systemMetrics.mongodbConnected = mongodbConnected;
  }

  /**
   * Get all metrics in Prometheus text format
   */
  getPrometheusMetrics() {
    let output = '# HELP crypto_wallet_metrics Crypto Wallet Platform Metrics\n';
    output += '# TYPE crypto_wallet_metrics gauge\n\n';

    // HTTP metrics
    output += '# HTTP Metrics\n';
    output += `# HELP http_requests_total Total HTTP requests by method and path\n`;
    output += `# TYPE http_requests_total counter\n`;
    
    for (const [key, metric] of this.httpRequests.entries()) {
      output += `http_requests_total{endpoint="${key}"} ${metric.count}\n`;
      output += `http_request_duration_ms_sum{endpoint="${key}"} ${metric.totalDuration}\n`;
      output += `http_request_errors_total{endpoint="${key}"} ${metric.errors}\n`;
    }

    // HTTP status codes
    output += `\n# HELP http_responses_total Total HTTP responses by status code\n`;
    output += `# TYPE http_responses_total counter\n`;
    for (const [status, count] of this.httpStatusCodes.entries()) {
      output += `http_responses_total{status="${status}"} ${count}\n`;
    }

    // Auth metrics
    output += `\n# AUTH Metrics\n`;
    output += `# HELP auth_login_attempts_total Total login attempts\n`;
    output += `# TYPE auth_login_attempts_total counter\n`;
    output += `auth_login_attempts_total ${this.authMetrics.loginAttempts}\n`;
    output += `auth_login_successes_total ${this.authMetrics.loginSuccesses}\n`;
    output += `auth_login_failures_total ${this.authMetrics.loginFailures}\n`;
    output += `auth_refresh_tokens_total ${this.authMetrics.refreshTokens}\n`;
    output += `auth_logouts_total ${this.authMetrics.logouts}\n`;
    output += `auth_token_revocations_total ${this.authMetrics.tokenRevocations}\n`;
    output += `auth_token_blacklist_total ${this.authMetrics.tokenBlacklist}\n`;

    // Error metrics
    output += `\n# ERROR Metrics\n`;
    output += `# HELP errors_total Total errors by type\n`;
    output += `# TYPE errors_total counter\n`;
    output += `errors_total ${this.errorMetrics.total}\n`;
    for (const [errorType, count] of this.errorMetrics.byType.entries()) {
      output += `errors_by_type{type="${errorType}"} ${count}\n`;
    }

    // Business metrics
    output += `\n# BUSINESS Metrics\n`;
    output += `wallets_created_total ${this.businessMetrics.walletsCreated}\n`;
    output += `transactions_sent_total ${this.businessMetrics.transactionsSent}\n`;
    output += `wallet_recoveries_total ${this.businessMetrics.walletRecoveries}\n`;
    output += `kyc_submissions_total ${this.businessMetrics.kycsSubmitted}\n`;
    output += `webhooks_dispatched_total ${this.businessMetrics.webhooksDispatched}\n`;

    // System metrics
    output += `\n# SYSTEM Metrics\n`;
    output += `system_memory_usage_percent ${this.systemMetrics.memoryUsage}\n`;
    output += `system_uptime_seconds ${this.systemMetrics.uptime}\n`;
    output += `mongodb_connected{status="${this.systemMetrics.mongodbConnected ? 'true' : 'false'}"} 1\n`;

    return output;
  }

  /**
   * Get JSON summary of all metrics
   */
  getMetricsSummary() {
    const httpEndpoints = Array.from(this.httpRequests.entries()).map(([key, metric]) => ({
      endpoint: key,
      requests: metric.count,
      errors: metric.errors,
      avgDurationMs: metric.count > 0 ? Math.round(metric.totalDuration / metric.count) : 0
    }));

    return {
      timestamp: new Date().toISOString(),
      uptime: this.systemMetrics.uptime,
      http: {
        totalRequests: Array.from(this.httpRequests.values()).reduce((sum, m) => sum + m.count, 0),
        totalErrors: Array.from(this.httpRequests.values()).reduce((sum, m) => sum + m.errors, 0),
        statusCodes: Object.fromEntries(this.httpStatusCodes),
        endpoints: httpEndpoints
      },
      auth: this.authMetrics,
      errors: {
        total: this.errorMetrics.total,
        byType: Object.fromEntries(this.errorMetrics.byType)
      },
      business: this.businessMetrics,
      system: this.systemMetrics
    };
  }

  /**
   * Reset metrics (useful for testing or scheduled resets)
   */
  reset() {
    this.httpRequests.clear();
    this.httpStatusCodes.clear();
    this.authMetrics = {
      loginAttempts: 0,
      loginSuccesses: 0,
      loginFailures: 0,
      refreshTokens: 0,
      logouts: 0,
      tokenRevocations: 0,
      tokenBlacklist: 0
    };
    this.errorMetrics = {
      total: 0,
      byType: new Map()
    };
    this.businessMetrics = {
      walletsCreated: 0,
      transactionsSent: 0,
      walletRecoveries: 0,
      kycsSubmitted: 0,
      webhooksDispatched: 0
    };
  }
}

module.exports = new MetricsService();
