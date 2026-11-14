import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { TestDatabase } from './helpers/test-database.js';

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Set test database URL (use in-memory or skip for unit tests)
  process.env.DATABASE_URL = 'postgresql://basha_vara_user:test_password@localhost:5434/basha_vara_test';
  process.env.DIRECT_URL = 'postgresql://basha_vara_user:test_password@localhost:5434/basha_vara_test';
  
  // Set test Redis URL
  process.env.REDIS_URL = 'redis://localhost:6380';
  
  // Set test JWT secrets
  process.env.JWT_SECRET = 'test_jwt_secret_for_testing_only';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_for_testing_only';
  
  // Set test email config
  process.env.EMAIL_FROM = 'test@example.com';
  process.env.BREVO_API_KEY = 'test_brevo_key';
  
  // Set test frontend URL
  process.env.FRONTEND_URL = 'http://localhost:3000';
});

afterAll(async () => {
  // Cleanup after all tests
  try {
    await TestDatabase.disconnect();
  } catch (error) {
    // Ignore errors if database is not available
    console.warn('Test database cleanup failed:', error);
  }
});

beforeEach(async () => {
  // For unit tests, we don't need to setup database
  // Only setup for integration tests that require database
  // This prevents unit tests from failing due to missing database
});

afterEach(async () => {
  // Cleanup after each test (only for integration tests)
  // For unit tests, this is a no-op
});
