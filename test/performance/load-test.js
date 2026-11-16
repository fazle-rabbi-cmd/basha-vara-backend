// Performance Testing Script
// Run with: node test/performance/load-test.js

import http from 'node:http';
import { performance } from 'node:perf_hooks';

const BASE_URL = process.env.API_URL || 'http://localhost:4000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const PUBLIC_ENDPOINTS = [
  '/api/v1/properties',
  '/api/v1/properties/amenities/list',
  '/api/v1/health',
];
const AUTH_ENDPOINTS = ['/api/v1/auth/me'];
const ENDPOINTS = AUTH_TOKEN ? [...PUBLIC_ENDPOINTS, ...AUTH_ENDPOINTS] : PUBLIC_ENDPOINTS;

const CONCURRENT_REQUESTS = 10;
const TOTAL_REQUESTS = 100;

async function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const url = new URL(path, BASE_URL);

    const headers = {
      'Content-Type': 'application/json',
    };
    if (AUTH_TOKEN && AUTH_ENDPOINTS.includes(path)) {
      headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      headers,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const duration = performance.now() - start;
        resolve({
          status: res.statusCode,
          duration,
          data: JSON.parse(data || '{}'),
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runLoadTest() {
  console.log('Starting performance test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Concurrent requests: ${CONCURRENT_REQUESTS}`);
  console.log(`Total requests: ${TOTAL_REQUESTS}\n`);

  const results = {
    total: 0,
    successful: 0,
    failed: 0,
    responseTimes: [],
    errors: [],
  };

  const startTime = performance.now();

  // Run concurrent requests
  const batches = Math.ceil(TOTAL_REQUESTS / CONCURRENT_REQUESTS);
  
  for (let batch = 0; batch < batches; batch++) {
    const batchStart = batch * CONCURRENT_REQUESTS;
    const batchEnd = Math.min(batchStart + CONCURRENT_REQUESTS, TOTAL_REQUESTS);
    const batchSize = batchEnd - batchStart;

    const promises = [];
    for (let i = 0; i < batchSize; i++) {
      const endpoint = ENDPOINTS[i % ENDPOINTS.length];
      promises.push(
        makeRequest(endpoint)
          .then(result => {
            results.total++;
            results.responseTimes.push(result.duration);
            if (result.status >= 200 && result.status < 300) {
              results.successful++;
            } else {
              results.failed++;
              results.errors.push({
                endpoint,
                status: result.status,
                error: result.data.message || 'Unknown error',
              });
            }
          })
          .catch(error => {
            results.total++;
            results.failed++;
            results.errors.push({
              endpoint,
              error: error.message,
            });
          })
      );
    }

    await Promise.all(promises);
    
    // Log progress
    if ((batch + 1) % 10 === 0) {
      console.log(`Progress: ${Math.min((batch + 1) * CONCURRENT_REQUESTS, TOTAL_REQUESTS)}/${TOTAL_REQUESTS} requests completed`);
    }
  }

  const totalTime = performance.now() - startTime;
  const avgResponseTime = results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length;
  const minResponseTime = Math.min(...results.responseTimes);
  const maxResponseTime = Math.max(...results.responseTimes);
  const throughput = (results.total / totalTime) * 1000; // requests per second

  console.log('\n=== Performance Test Results ===');
  console.log(`Total Requests: ${results.total}`);
  console.log(`Successful: ${results.successful}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.successful / results.total) * 100).toFixed(2)}%`);
  console.log(`\nResponse Times:`);
  console.log(`  Average: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`  Min: ${minResponseTime.toFixed(2)}ms`);
  console.log(`  Max: ${maxResponseTime.toFixed(2)}ms`);
  console.log(`\nThroughput: ${throughput.toFixed(2)} requests/second`);
  console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);

  if (results.errors.length > 0) {
    console.log('\n=== Errors ===');
    results.errors.slice(0, 5).forEach(error => {
      console.log(`- ${error.endpoint}: ${error.error}`);
    });
  }

  // Performance thresholds
  const thresholds = {
    avgResponseTime: 500, // ms
    maxResponseTime: 2000, // ms
    successRate: 95, // %
    throughput: 10, // requests/second
  };

  console.log('\n=== Performance Thresholds ===');
  const passed = [];
  const failed = [];

  if (avgResponseTime < thresholds.avgResponseTime) {
    passed.push(`Average response time: ${avgResponseTime.toFixed(2)}ms < ${thresholds.avgResponseTime}ms`);
  } else {
    failed.push(`Average response time: ${avgResponseTime.toFixed(2)}ms >= ${thresholds.avgResponseTime}ms`);
  }

  if (maxResponseTime < thresholds.maxResponseTime) {
    passed.push(`Max response time: ${maxResponseTime.toFixed(2)}ms < ${thresholds.maxResponseTime}ms`);
  } else {
    failed.push(`Max response time: ${maxResponseTime.toFixed(2)}ms >= ${thresholds.maxResponseTime}ms`);
  }

  const successRate = (results.successful / results.total) * 100;
  if (successRate >= thresholds.successRate) {
    passed.push(`Success rate: ${successRate.toFixed(2)}% >= ${thresholds.successRate}%`);
  } else {
    failed.push(`Success rate: ${successRate.toFixed(2)}% < ${thresholds.successRate}%`);
  }

  if (throughput >= thresholds.throughput) {
    passed.push(`Throughput: ${throughput.toFixed(2)} req/s >= ${thresholds.throughput} req/s`);
  } else {
    failed.push(`Throughput: ${throughput.toFixed(2)} req/s < ${thresholds.throughput} req/s`);
  }

  console.log('\nPassed:');
  passed.forEach(p => console.log(`  ✅ ${p}`));
  
  console.log('\nFailed:');
  failed.forEach(f => console.log(`  ❌ ${f}`));

  const overallPassed = failed.length === 0;
  console.log(`\n=== Overall Result: ${overallPassed ? 'PASSED' : 'FAILED'} ===`);
  
  process.exit(overallPassed ? 0 : 1);
}

runLoadTest().catch(error => {
  console.error('Performance test failed:', error);
  process.exit(1);
});
