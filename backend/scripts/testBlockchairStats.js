/**
 * Blockchair Stats API Test Suite
 * Tests all blockchain statistics endpoints
 */

require('dotenv').config();
const blockchairService = require('../services/blockchairService');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

function logSuccess(message) {
  log(colors.green, '✅', message);
}

function logError(message) {
  log(colors.red, '❌', message);
}

function logInfo(message) {
  log(colors.cyan, 'ℹ️ ', message);
}

function logWarning(message) {
  log(colors.yellow, '⚠️ ', message);
}

function logSection(title) {
  console.log('\n' + colors.bright + colors.blue + '═══════════════════════════════════════════════════════' + colors.reset);
  console.log(colors.bright + colors.blue + `  ${title}` + colors.reset);
  console.log(colors.bright + colors.blue + '═══════════════════════════════════════════════════════' + colors.reset + '\n');
}

// Delay helper to respect rate limits
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test counter
let testsPassed = 0;
let testsFailed = 0;

/**
 * Test: Get all blockchain stats at once
 */
async function testAllStats() {
  logSection('Test 1: Get All Blockchain Stats');
  
  try {
    logInfo('Fetching stats for 15+ blockchains in one call...');
    const stats = await blockchairService.getAllStats();
    
    if (stats && typeof stats === 'object' && Object.keys(stats).length > 0) {
      logSuccess(`Retrieved stats for ${Object.keys(stats).length} blockchains`);
      
      // Show some key data
      if (stats.bitcoin) {
        logInfo(`Bitcoin blocks: ${stats.bitcoin.data?.blocks || 'N/A'}`);
        logInfo(`Bitcoin price: $${stats.bitcoin.data?.market_price_usd || 'N/A'}`);
      }
      
      if (stats.ethereum) {
        logInfo(`Ethereum blocks: ${stats.ethereum.data?.blocks || 'N/A'}`);
        logInfo(`Ethereum price: $${stats.ethereum.data?.market_price_usd || 'N/A'}`);
      }
      
      testsPassed++;
    } else {
      logError('No stats data returned');
      testsFailed++;
    }
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Test: Bitcoin stats
 */
async function testBitcoinStats() {
  logSection('Test 2: Bitcoin Blockchain Stats');
  
  try {
    logInfo('Fetching Bitcoin statistics...');
    const stats = await blockchairService.getBitcoinLikeStats('bitcoin');
    
    if (stats) {
      logSuccess('Bitcoin stats retrieved successfully');
      
      // Display key metrics
      console.log(colors.cyan + '\nKey Metrics:' + colors.reset);
      console.log(`  Blocks: ${stats.blocks?.toLocaleString() || 'N/A'}`);
      console.log(`  Transactions: ${stats.transactions?.toLocaleString() || 'N/A'}`);
      console.log(`  Difficulty: ${stats.difficulty?.toLocaleString() || 'N/A'}`);
      console.log(`  Hashrate (24h): ${stats.hashrate_24h || 'N/A'}`);
      console.log(`  Best Block: #${stats.best_block_height || 'N/A'}`);
      console.log(`  Mempool Transactions: ${stats.mempool_transactions || 'N/A'}`);
      console.log(`  Mempool Size: ${stats.mempool_size ? (stats.mempool_size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}`);
      
      console.log(colors.cyan + '\n24h Activity:' + colors.reset);
      console.log(`  Blocks: ${stats.blocks_24h || 'N/A'}`);
      console.log(`  Transactions: ${stats.transactions_24h?.toLocaleString() || 'N/A'}`);
      console.log(`  Avg Fee: ${stats.average_transaction_fee_usd_24h ? '$' + stats.average_transaction_fee_usd_24h.toFixed(4) : 'N/A'}`);
      console.log(`  Volume: ${stats.volume_24h ? (stats.volume_24h / 1e8).toFixed(2) + ' BTC' : 'N/A'}`);
      
      console.log(colors.cyan + '\nMarket Data:' + colors.reset);
      console.log(`  Price: $${stats.market_price_usd?.toLocaleString() || 'N/A'}`);
      console.log(`  Market Cap: $${stats.market_cap_usd ? (stats.market_cap_usd / 1e9).toFixed(2) + 'B' : 'N/A'}`);
      console.log(`  Dominance: ${stats.market_dominance_percentage || 'N/A'}%`);
      console.log(`  24h Change: ${stats.market_price_usd_change_24h_percentage || 'N/A'}%`);
      
      console.log(colors.cyan + '\nFee Recommendation:' + colors.reset);
      console.log(`  Suggested Fee: ${stats.suggested_transaction_fee_per_byte_sat || 'N/A'} sat/byte`);
      
      testsPassed++;
    } else {
      logError('No Bitcoin stats returned');
      testsFailed++;
    }
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Test: Ethereum stats
 */
async function testEthereumStats() {
  logSection('Test 3: Ethereum Blockchain Stats');
  
  try {
    logInfo('Fetching Ethereum statistics...');
    const stats = await blockchairService.getEthereumLikeStats('ethereum');
    
    if (stats) {
      logSuccess('Ethereum stats retrieved successfully');
      
      // Display key metrics
      console.log(colors.cyan + '\nKey Metrics:' + colors.reset);
      console.log(`  Blocks: ${stats.blocks?.toLocaleString() || 'N/A'}`);
      console.log(`  Transactions: ${stats.transactions?.toLocaleString() || 'N/A'}`);
      console.log(`  Calls: ${stats.calls?.toLocaleString() || 'N/A'}`);
      console.log(`  Uncles: ${stats.uncles?.toLocaleString() || 'N/A'}`);
      console.log(`  Best Block: #${stats.best_block_height || 'N/A'}`);
      console.log(`  Mempool Transactions: ${stats.mempool_transactions || 'N/A'}`);
      console.log(`  Mempool Median Gas: ${stats.mempool_median_gas_price ? (stats.mempool_median_gas_price / 1e9) + ' gwei' : 'N/A'}`);
      
      console.log(colors.cyan + '\n24h Activity:' + colors.reset);
      console.log(`  Blocks: ${stats.blocks_24h || 'N/A'}`);
      console.log(`  Transactions: ${stats.transactions_24h?.toLocaleString() || 'N/A'}`);
      console.log(`  Avg Fee: ${stats.average_transaction_fee_usd_24h ? '$' + stats.average_transaction_fee_usd_24h.toFixed(4) : 'N/A'}`);
      
      console.log(colors.cyan + '\nMarket Data:' + colors.reset);
      console.log(`  Price: $${stats.market_price_usd?.toLocaleString() || 'N/A'}`);
      console.log(`  Market Cap: $${stats.market_cap_usd ? (stats.market_cap_usd / 1e9).toFixed(2) + 'B' : 'N/A'}`);
      console.log(`  Dominance: ${stats.market_dominance_percentage || 'N/A'}%`);
      
      // ERC-20 stats
      if (stats.layer_2 && stats.layer_2.erc_20) {
        console.log(colors.cyan + '\nERC-20 Stats:' + colors.reset);
        console.log(`  Tokens: ${stats.layer_2.erc_20.tokens?.toLocaleString() || 'N/A'}`);
        console.log(`  Transactions: ${stats.layer_2.erc_20.transactions?.toLocaleString() || 'N/A'}`);
        console.log(`  Tokens (24h): ${stats.layer_2.erc_20.tokens_24h || 'N/A'}`);
        console.log(`  Transactions (24h): ${stats.layer_2.erc_20.transactions_24h?.toLocaleString() || 'N/A'}`);
      }
      
      // Gas price recommendations
      if (stats.suggested_transaction_fee_gwei_options) {
        console.log(colors.cyan + '\nGas Price Options (gwei):' + colors.reset);
        const gas = stats.suggested_transaction_fee_gwei_options;
        console.log(`  🐌 Sloth: ${gas.sloth || 'N/A'} (risk and wait)`);
        console.log(`  🐢 Slow: ${gas.slow || 'N/A'} (5-10 min)`);
        console.log(`  ⚡ Normal: ${gas.normal || 'N/A'} (2-5 min)`);
        console.log(`  🚀 Fast: ${gas.fast || 'N/A'} (1-2 min)`);
        console.log(`  🐆 Cheetah: ${gas.cheetah || 'N/A'} (next block)`);
      }
      
      testsPassed++;
    } else {
      logError('No Ethereum stats returned');
      testsFailed++;
    }
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Test: Get gas prices
 */
async function testGasPrices() {
  logSection('Test 4: Ethereum Gas Prices');
  
  try {
    logInfo('Fetching Ethereum gas prices...');
    const gasPrices = await blockchairService.getGasPrices('ethereum');
    
    if (gasPrices) {
      logSuccess('Gas prices retrieved successfully');
      
      console.log(colors.cyan + '\nGas Price Recommendations:' + colors.reset);
      console.log(`  Sloth: ${gasPrices.sloth} gwei`);
      console.log(`  Slow: ${gasPrices.slow} gwei`);
      console.log(`  Normal: ${gasPrices.normal} gwei`);
      console.log(`  Fast: ${gasPrices.fast} gwei`);
      console.log(`  Cheetah: ${gasPrices.cheetah} gwei`);
      console.log(`  Mempool Median: ${gasPrices.mempoolMedian ? (gasPrices.mempoolMedian / 1e9).toFixed(2) : 'N/A'} gwei`);
      
      testsPassed++;
    } else {
      logError('No gas prices returned');
      testsFailed++;
    }
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Test: Market data extraction
 */
async function testMarketData() {
  logSection('Test 5: Market Data Extraction');
  
  const chains = ['bitcoin', 'ethereum', 'litecoin'];
  
  for (const chain of chains) {
    try {
      logInfo(`Fetching market data for ${chain}...`);
      const marketData = await blockchairService.getMarketData(chain);
      
      if (marketData) {
        logSuccess(`${chain} market data retrieved`);
        console.log(`  Price: $${marketData.priceUsd?.toLocaleString() || 'N/A'}`);
        console.log(`  24h Change: ${marketData.change24h}%`);
        console.log(`  Market Cap: $${marketData.marketCap ? (marketData.marketCap / 1e9).toFixed(2) + 'B' : 'N/A'}`);
        console.log(`  Dominance: ${marketData.dominance}%`);
        testsPassed++;
      } else {
        logError(`No market data for ${chain}`);
        testsFailed++;
      }
      
      await delay(2000); // Rate limit protection
    } catch (error) {
      logError(`${chain} test failed: ${error.message}`);
      testsFailed++;
    }
  }
}

/**
 * Test: Network health metrics
 */
async function testNetworkHealth() {
  logSection('Test 6: Network Health Metrics');
  
  try {
    logInfo('Fetching Bitcoin network health...');
    const health = await blockchairService.getNetworkHealth('bitcoin');
    
    if (health) {
      logSuccess('Network health metrics retrieved');
      
      console.log(colors.cyan + '\nMempool Status:' + colors.reset);
      console.log(`  Transactions: ${health.mempoolTransactions?.toLocaleString() || 'N/A'}`);
      console.log(`  Size: ${health.mempoolSize ? (health.mempoolSize / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}`);
      console.log(`  TPS: ${health.mempoolTps?.toFixed(2) || 'N/A'}`);
      
      console.log(colors.cyan + '\n24h Activity:' + colors.reset);
      console.log(`  Transactions: ${health.transactions24h?.toLocaleString() || 'N/A'}`);
      console.log(`  Blocks: ${health.blocks24h || 'N/A'}`);
      console.log(`  Avg Fee: $${health.avgFee24h?.toFixed(4) || 'N/A'}`);
      console.log(`  Median Fee: $${health.medianFee24h?.toFixed(4) || 'N/A'}`);
      
      console.log(colors.cyan + '\nNetwork Power:' + colors.reset);
      console.log(`  Hashrate: ${health.hashrate24h || 'N/A'}`);
      console.log(`  Difficulty: ${health.difficulty?.toLocaleString() || 'N/A'}`);
      
      testsPassed++;
    } else {
      logError('No network health data returned');
      testsFailed++;
    }
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Test: Ripple stats
 */
async function testRippleStats() {
  logSection('Test 7: Ripple (XRP) Stats');
  
  try {
    logInfo('Fetching Ripple statistics...');
    const stats = await blockchairService.getRippleStats();
    
    if (stats) {
      logSuccess('Ripple stats retrieved successfully');
      
      console.log(colors.cyan + '\nKey Metrics:' + colors.reset);
      console.log(`  Ledgers: ${stats.ledgers?.toLocaleString() || 'N/A'}`);
      console.log(`  Best Ledger: #${stats.best_ledger_height || 'N/A'}`);
      console.log(`  Circulation: ${stats.circulation ? (stats.circulation / 1e6).toFixed(0) + ' XRP' : 'N/A'}`);
      console.log(`  Mempool TPS: ${stats.mempool_tps?.toFixed(2) || 'N/A'}`);
      
      console.log(colors.cyan + '\n24h Activity:' + colors.reset);
      console.log(`  Ledgers: ${stats.ledgers_24h || 'N/A'}`);
      console.log(`  Transactions: ${stats.transactions_24h?.toLocaleString() || 'N/A'}`);
      console.log(`  Avg Fee: $${stats.average_transaction_fee_usd_24h?.toFixed(6) || 'N/A'}`);
      
      console.log(colors.cyan + '\nMarket Data:' + colors.reset);
      console.log(`  Price: $${stats.market_price_usd || 'N/A'}`);
      console.log(`  Market Cap: $${stats.market_cap_usd ? (stats.market_cap_usd / 1e9).toFixed(2) + 'B' : 'N/A'}`);
      
      testsPassed++;
    } else {
      logError('No Ripple stats returned');
      testsFailed++;
    }
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Test: ERC-20 token stats
 */
async function testErc20Stats() {
  logSection('Test 8: ERC-20 Token Stats');
  
  try {
    logInfo('Fetching ERC-20 statistics...');
    const stats = await blockchairService.getErc20Stats();
    
    if (stats) {
      logSuccess('ERC-20 stats retrieved successfully');
      
      console.log(colors.cyan + '\nERC-20 Ecosystem:' + colors.reset);
      console.log(`  Total Tokens: ${stats.tokens?.toLocaleString() || 'N/A'}`);
      console.log(`  Total Transactions: ${stats.transactions?.toLocaleString() || 'N/A'}`);
      console.log(`  New Tokens (24h): ${stats.tokens_24h || 'N/A'}`);
      console.log(`  Transactions (24h): ${stats.transactions_24h?.toLocaleString() || 'N/A'}`);
      
      testsPassed++;
    } else {
      logError('No ERC-20 stats returned');
      testsFailed++;
    }
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    testsFailed++;
  }
}

/**
 * Test: Auto-detect chain type with getStats()
 */
async function testAutoDetectStats() {
  logSection('Test 9: Auto-Detect Chain Type');
  
  const testCases = [
    { chain: 'bitcoin', expected: 'Bitcoin-like' },
    { chain: 'ethereum', expected: 'Ethereum-like' },
    { chain: 'ripple', expected: 'Ripple' },
    { chain: 'xrp', expected: 'Ripple (alias)' }
  ];
  
  for (const testCase of testCases) {
    try {
      logInfo(`Testing ${testCase.chain} → ${testCase.expected}...`);
      const stats = await blockchairService.getStats(testCase.chain);
      
      if (stats && (stats.blocks || stats.ledgers || stats.snapshots)) {
        logSuccess(`${testCase.chain} correctly identified as ${testCase.expected}`);
        testsPassed++;
      } else {
        logError(`Failed to get stats for ${testCase.chain}`);
        testsFailed++;
      }
      
      await delay(2000);
    } catch (error) {
      logError(`${testCase.chain} test failed: ${error.message}`);
      testsFailed++;
    }
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log(colors.bright + colors.magenta);
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                                                               ║');
  console.log('║         BLOCKCHAIR STATS API COMPREHENSIVE TEST SUITE         ║');
  console.log('║                                                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);
  
  // Check API key
  if (blockchairService.hasApiKey()) {
    logSuccess(`API Key: Configured (${process.env.BLOCKCHAIR_API_KEY.substring(0, 10)}...)`);
    logInfo('Running with enhanced rate limit (1,440 requests/day)');
  } else {
    logWarning('API Key: Not configured');
    logInfo('Running on free tier (1 request/minute)');
    logInfo('Add BLOCKCHAIR_API_KEY to .env for better performance');
  }
  
  console.log('');
  
  const startTime = Date.now();
  
  // Run all tests
  await testAllStats();
  await delay(2000);
  
  await testBitcoinStats();
  await delay(2000);
  
  await testEthereumStats();
  await delay(2000);
  
  await testGasPrices();
  await delay(2000);
  
  await testMarketData();
  await delay(2000);
  
  await testNetworkHealth();
  await delay(2000);
  
  await testRippleStats();
  await delay(2000);
  
  await testErc20Stats();
  await delay(2000);
  
  await testAutoDetectStats();
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  // Summary
  logSection('Test Summary');
  
  const totalTests = testsPassed + testsFailed;
  const successRate = ((testsPassed / totalTests) * 100).toFixed(1);
  
  console.log(colors.bright + `Total Tests: ${totalTests}` + colors.reset);
  console.log(colors.green + `✅ Passed: ${testsPassed}` + colors.reset);
  console.log(colors.red + `❌ Failed: ${testsFailed}` + colors.reset);
  console.log(colors.cyan + `📊 Success Rate: ${successRate}%` + colors.reset);
  console.log(colors.yellow + `⏱️  Duration: ${duration}s` + colors.reset);
  
  console.log('');
  
  if (testsFailed === 0) {
    logSuccess('All tests passed! 🎉');
  } else {
    logWarning(`${testsFailed} test(s) failed. Check the logs above for details.`);
  }
  
  console.log('\n' + colors.cyan + 'For more information, visit: https://blockchair.com/api/docs' + colors.reset);
  console.log('');
}

// Run the tests
runTests().catch(error => {
  console.error(colors.red + 'Fatal error:', error, colors.reset);
  process.exit(1);
});
