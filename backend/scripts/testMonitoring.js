#!/usr/bin/env node
/**
 * Test monitoring and metrics endpoints
 */

const http = require('http');

const endpoints = [
  { path: '/api/health', description: 'Health check endpoint' },
  { path: '/api/metrics', description: 'Prometheus metrics endpoint' },
  { path: '/api/metrics/summary', description: 'JSON metrics summary' }
];

async function testEndpoint(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET',
      timeout: 5000
    };

    const https = require('https');
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, isJson: true });
        } catch {
          resolve({ status: res.statusCode, data: data.substring(0, 200), isJson: false });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ status: 'error', error: err.message });
    });

    req.on('timeout', () => {
      req.abort();
      resolve({ status: 'timeout' });
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing monitoring endpoints...\n');
  
  for (const endpoint of endpoints) {
    console.log(`Testing: ${endpoint.description}`);
    console.log(`  Path: ${endpoint.path}`);
    
    const result = await testEndpoint(endpoint.path);
    
    if (result.status === 200) {
      console.log(`  ✅ Status: ${result.status}`);
      if (result.isJson) {
        console.log(`  Data keys: ${Object.keys(result.data).join(', ')}`);
      } else {
        console.log(`  Response: ${result.data}`);
      }
    } else if (result.error) {
      console.log(`  ❌ Error: ${result.error}`);
    } else {
      console.log(`  ❌ Status: ${result.status}`);
    }
    console.log();
  }

  console.log('Monitoring endpoints test complete!');
  process.exit(0);
}

// Wait for server to be ready
setTimeout(runTests, 2000);
