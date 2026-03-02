#!/usr/bin/env node
/**
 * Quick monitoring test
 */
const http = require('http');

function test(path) {
  return new Promise((resolve) => {
    const https = require('https');
    const req = https.get(`https://localhost:5000${path}`, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        console.log(`\n${path}`);
        console.log(`Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log(JSON.stringify(json, null, 2));
        } catch {
          console.log(data.substring(0, 300));
        }
        resolve();
      });
    });
    req.on('error', e => {
      console.log(`Error: ${e.message}`);
      resolve();
    });
  });
}

async function run() {
  console.log('Testing Monitoring Endpoints...');
  await test('/api/health');
  await test('/api/metrics/summary');
  console.log('\n✅ Tests complete');
  process.exit(0);
}

setTimeout(run, 1000);
