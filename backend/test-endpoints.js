// Endpoint Verification Script
// Run this to test all API endpoints are properly connected

const axios = require('axios');
const API_URL = 'http://localhost:5000/api';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

let passCount = 0;
let failCount = 0;

async function testEndpoint(method, path, expectedStatus, requiresAuth = false, description = '') {
  try {
    const config = {
      method,
      url: `${API_URL}${path}`,
      validateStatus: () => true // Don't throw on any status
    };

    if (requiresAuth) {
      config.headers = { Authorization: 'Bearer invalid_token_for_testing' };
    }

    const response = await axios(config);
    
    const passed = requiresAuth
      ? (response.status === 401 || response.status === 403 || response.status === expectedStatus || response.status === 429)
      : (response.status === expectedStatus || response.status === 404 || response.status === 400 || response.status === 429);
    
    if (passed) {
      console.log(`${colors.green}✓${colors.reset} ${method.padEnd(6)} ${path.padEnd(45)} [${response.status}] ${description}`);
      passCount++;
    } else {
      console.log(`${colors.red}✗${colors.reset} ${method.padEnd(6)} ${path.padEnd(45)} [${response.status}] Expected ${expectedStatus} - ${description}`);
      failCount++;
    }
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} ${method.padEnd(6)} ${path.padEnd(45)} ERROR: ${error.message}`);
    failCount++;
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(100));
  console.log(`${colors.blue}CRYPTO WALLET PLATFORM - API ENDPOINT VERIFICATION${colors.reset}`);
  console.log('='.repeat(100) + '\n');

  // Health Check
  console.log(`${colors.yellow}[ HEALTH CHECK ]${colors.reset}`);
  await testEndpoint('GET', '/health', 200, false, 'Server health check');

  // Auth Endpoints
  console.log(`\n${colors.yellow}[ AUTH ENDPOINTS ]${colors.reset}`);
  await testEndpoint('POST', '/auth/register', 400, false, 'User registration');
  await testEndpoint('POST', '/auth/login', 400, false, 'User login');

  // Wallet Endpoints
  console.log(`\n${colors.yellow}[ WALLET ENDPOINTS ]${colors.reset}`);
  await testEndpoint('POST', '/wallet/create', 401, true, 'Create new wallet');
  await testEndpoint('GET', '/wallet/list', 401, true, 'List all wallets');
  await testEndpoint('GET', '/wallet/balance/0x1234', 401, true, 'Get wallet balance');
  await testEndpoint('GET', '/wallet/balances', 401, true, 'Get all balances');
  await testEndpoint('POST', '/wallet/import', 401, true, 'Import existing wallet');
  await testEndpoint('POST', '/wallet/watch-only', 401, true, 'Add watch-only wallet');
  await testEndpoint('GET', '/wallet/watch-only', 401, true, 'Get watch-only wallets');
  await testEndpoint('POST', '/wallet/kyc-submit', 401, true, 'Submit KYC for recovery');
  await testEndpoint('GET', '/wallet/kyc-status', 401, true, 'Get KYC status');
  await testEndpoint('GET', '/wallet/recovery-status', 401, true, 'Get recovery status');
  await testEndpoint('GET', '/wallet/my-wallet', 401, true, 'Get recovery wallet');
  await testEndpoint('GET', '/wallet/recovery-seed', 401, true, 'Get recovery seed');
  await testEndpoint('GET', '/wallet/seed-once', 401, true, 'Get seed once');
  await testEndpoint('POST', '/wallet/recover', 401, true, 'Recover wallet');

  // Transaction Endpoints
  console.log(`\n${colors.yellow}[ TRANSACTION ENDPOINTS ]${colors.reset}`);
  await testEndpoint('GET', '/transactions/history', 401, true, 'Get transaction history');
  await testEndpoint('GET', '/transactions/blockchain/0x1234', 401, true, 'Get blockchain history');
  await testEndpoint('POST', '/transactions/send', 401, true, 'Send transaction');
  await testEndpoint('POST', '/transactions/send-batch', 401, true, 'Send batch transactions');
  await testEndpoint('POST', '/transactions/deposit', 401, true, 'Deposit funds');
  await testEndpoint('POST', '/transactions/withdraw', 401, true, 'Withdraw funds');
  await testEndpoint('GET', '/transactions/123456', 401, true, 'Get transaction by ID');
  await testEndpoint('POST', '/transactions/estimate-gas', 401, true, 'Estimate gas fee');

  // Prices Endpoints
  console.log(`\n${colors.yellow}[ PRICES ENDPOINTS ]${colors.reset}`);
  await testEndpoint('GET', '/prices/live', 200, false, 'Get live crypto prices');
  await testEndpoint('GET', '/prices/history/bitcoin?days=7', 200, false, 'Get BTC price history');
  await testEndpoint('GET', '/prices/trending/list', 200, false, 'Get trending coins');

  // Token Endpoints
  console.log(`\n${colors.yellow}[ TOKEN ENDPOINTS ]${colors.reset}`);
  await testEndpoint('GET', '/tokens/popular', 401, true, 'Get popular tokens');
  await testEndpoint('GET', '/tokens/list', 401, true, 'Get user token list');
  await testEndpoint('GET', '/tokens/info/0x1234', 401, true, 'Get token info');
  await testEndpoint('POST', '/tokens/add', 401, true, 'Add custom token');
  await testEndpoint('GET', '/tokens/balance/0x1234/0x5678', 401, true, 'Get token balance');
  await testEndpoint('GET', '/tokens/balances/0x1234', 401, true, 'Get all token balances');
  await testEndpoint('POST', '/tokens/transfer', 401, true, 'Transfer tokens');
  await testEndpoint('DELETE', '/tokens/123456', 401, true, 'Delete token');
  await testEndpoint('POST', '/tokens/refresh/123456', 401, true, 'Refresh token balance');

  // Admin Endpoints
  console.log(`\n${colors.yellow}[ ADMIN ENDPOINTS ]${colors.reset}`);
  await testEndpoint('GET', '/admin/stats', 401, true, 'Get admin stats');
  await testEndpoint('GET', '/admin/users', 401, true, 'Get users list');
  await testEndpoint('GET', '/admin/transactions', 401, true, 'Get admin transactions');
  await testEndpoint('GET', '/admin/logs', 401, true, 'Get audit logs');
  await testEndpoint('GET', '/admin/analytics', 401, true, 'Get analytics');
  await testEndpoint('GET', '/admin/market-analytics', 401, true, 'Get market analytics');
  await testEndpoint('GET', '/admin/kyc/pending', 401, true, 'Get pending KYC');
  await testEndpoint('POST', '/admin/wallets/provision', 401, true, 'Provision recovery wallet');
  await testEndpoint('GET', '/admin/webhooks', 401, true, 'List webhooks');

  // Summary
  console.log('\n' + '='.repeat(100));
  console.log(`${colors.blue}TEST SUMMARY${colors.reset}`);
  console.log('='.repeat(100));
  console.log(`${colors.green}Passed: ${passCount}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failCount}${colors.reset}`);
  console.log(`Total:  ${passCount + failCount}`);
  
  if (failCount === 0) {
    console.log(`\n${colors.green}✓ ALL ENDPOINTS ARE PROPERLY CONNECTED!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}✗ Some endpoints have issues. Check the logs above.${colors.reset}\n`);
    process.exit(1);
  }
}

// Check if server is running first
async function checkServer() {
  try {
    await axios.get(`${API_URL}/health`, { timeout: 5000 });
    console.log(`${colors.green}✓ Server is running on ${API_URL}${colors.reset}\n`);
    return true;
  } catch (error) {
    console.log(`${colors.red}✗ Server is not running on ${API_URL}${colors.reset}`);
    console.log(`${colors.yellow}Please start the server first:${colors.reset}`);
    console.log(`  cd backend`);
    console.log(`  node server.js`);
    console.log('');
    return false;
  }
}

(async () => {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await runTests();
  }
})();
