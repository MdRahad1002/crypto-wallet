/**
 * Blockchair API Integration Test Script
 * 
 * This script tests the Blockchair service integration
 * Run with: node backend/scripts/testBlockchair.js
 */

require('dotenv').config();
const blockchairService = require('../services/blockchairService');

// Test Bitcoin address (Satoshi's first address)
const TEST_BTC_ADDRESS = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';

// Test Ethereum address (Vitalik's public address)
const TEST_ETH_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function logSuccess(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function logInfo(message) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

async function testApiKeyConfiguration() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: API Key Configuration');
  console.log('='.repeat(60));

  const hasKey = blockchairService.hasApiKey();
  
  if (hasKey) {
    logSuccess('Blockchair API key is configured');
    
    try {
      const status = await blockchairService.getRateLimitStatus();
      if (status.error) {
        logError(`API key validation failed: ${status.error}`);
      } else {
        logSuccess('API key is valid');
        console.log('   Rate limit info:', JSON.stringify(status, null, 2));
      }
    } catch (error) {
      logWarning(`Could not check rate limit: ${error.message}`);
    }
  } else {
    logWarning('No API key configured - using free tier (limited to 1 req/min)');
    logInfo('Add BLOCKCHAIR_API_KEY to .env file for better rate limits');
  }
}

async function testBitcoinBalance() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Bitcoin Balance');
  console.log('='.repeat(60));

  logInfo(`Testing with address: ${TEST_BTC_ADDRESS}`);
  
  try {
    const balance = await blockchairService.getBitcoinBalance(TEST_BTC_ADDRESS);
    
    logSuccess('Bitcoin balance fetched successfully');
    console.log('   Balance:', balance);
    
    if (balance.totalBtc > 0 || balance.transactionCount > 0) {
      logSuccess(`Address has ${balance.totalBtc} BTC and ${balance.transactionCount} transactions`);
    } else {
      logInfo('Address appears to be empty (which is expected for this test address)');
    }
  } catch (error) {
    logError(`Failed to fetch Bitcoin balance: ${error.message}`);
    console.error('   Error details:', error);
  }
}

async function testBitcoinTransactions() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Bitcoin Transactions');
  console.log('='.repeat(60));

  logInfo(`Testing with address: ${TEST_BTC_ADDRESS}`);
  
  try {
    const transactions = await blockchairService.getBitcoinTransactions(TEST_BTC_ADDRESS);
    
    logSuccess(`Fetched ${transactions.length} Bitcoin transactions`);
    
    if (transactions.length > 0) {
      console.log('   First transaction:', JSON.stringify(transactions[0], null, 2));
    } else {
      logInfo('No transactions found (or address has been cleaned up)');
    }
  } catch (error) {
    logError(`Failed to fetch Bitcoin transactions: ${error.message}`);
    console.error('   Error details:', error);
  }
}

async function testEthereumAsFlback() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: Ethereum Fallback');
  console.log('='.repeat(60));

  logInfo(`Testing with address: ${TEST_ETH_ADDRESS}`);
  
  try {
    const transactions = await blockchairService.getEthereumTransactions(TEST_ETH_ADDRESS);
    
    logSuccess(`Fetched ${transactions.length} Ethereum transactions via Blockchair`);
    
    if (transactions.length > 0) {
      console.log('   Transaction count:', transactions.length);
      console.log('   First transaction:', JSON.stringify(transactions[0], null, 2));
    }
  } catch (error) {
    logError(`Failed to fetch Ethereum transactions: ${error.message}`);
    console.error('   Error details:', error);
  }
}

async function testMempoolData() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 5: Bitcoin Mempool Data');
  console.log('='.repeat(60));

  try {
    const mempool = await blockchairService.getMempoolData();
    
    if (mempool && mempool.length > 0) {
      logSuccess('Mempool data fetched successfully');
      console.log(`   Mempool blocks: ${mempool.length}`);
    } else {
      logWarning('No mempool data returned (might require API key)');
    }
  } catch (error) {
    logError(`Failed to fetch mempool data: ${error.message}`);
    console.error('   Error details:', error);
  }
}

async function testRecommendedFees() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 6: Recommended Transaction Fees');
  console.log('='.repeat(60));

  try {
    const fees = await blockchairService.getRecommendedFees();
    
    logSuccess('Recommended fees fetched successfully');
    console.log('   Fees:', fees);
    console.log(`   Low: ${fees.low} ${fees.unit}`);
    console.log(`   Medium: ${fees.medium} ${fees.unit}`);
    console.log(`   High: ${fees.high} ${fees.unit}`);
  } catch (error) {
    logError(`Failed to fetch recommended fees: ${error.message}`);
    console.error('   Error details:', error);
  }
}

async function testAddressDashboard() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 7: Raw Dashboard API');
  console.log('='.repeat(60));

  logInfo(`Testing raw dashboard endpoint with: ${TEST_BTC_ADDRESS}`);
  
  try {
    const dashboard = await blockchairService.getAddressDashboard(TEST_BTC_ADDRESS, 'bitcoin');
    
    if (dashboard && dashboard[TEST_BTC_ADDRESS]) {
      logSuccess('Dashboard API response received');
      const addressData = dashboard[TEST_BTC_ADDRESS];
      console.log('   Address data keys:', Object.keys(addressData));
      
      if (addressData.address) {
        console.log('   Balance:', addressData.address.balance);
        console.log('   Transaction count:', addressData.address.transaction_count);
      }
      
      if (addressData.transactions) {
        console.log('   Transactions in response:', addressData.transactions.length);
      }
    } else {
      logWarning('Dashboard returned empty or unexpected format');
    }
  } catch (error) {
    logError(`Failed to fetch dashboard: ${error.message}`);
    console.error('   Error details:', error);
  }
}

async function runAllTests() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         BLOCKCHAIR API INTEGRATION TEST SUITE            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  try {
    await testApiKeyConfiguration();
    
    // Wait a bit between tests to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testBitcoinBalance();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testBitcoinTransactions();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testRecommendedFees();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testMempoolData();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testEthereumAsFlback();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testAddressDashboard();
    
    console.log('\n' + '='.repeat(60));
    console.log('ALL TESTS COMPLETED');
    console.log('='.repeat(60));
    
    if (!blockchairService.hasApiKey()) {
      console.log('\n' + colors.yellow + '💡 TIP: Add BLOCKCHAIR_API_KEY to .env for:' + colors.reset);
      console.log('   • Higher rate limits (1,440 req/day vs 1 req/min)');
      console.log('   • Better performance');
      console.log('   • Priority support');
      console.log('   Get your key at: https://blockchair.com/api');
    }
    
  } catch (error) {
    logError(`Test suite failed: ${error.message}`);
    console.error(error);
  }
  
  process.exit(0);
}

// Run tests
runAllTests();
