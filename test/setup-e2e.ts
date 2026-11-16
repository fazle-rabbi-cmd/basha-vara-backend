import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.test BEFORE any other imports
const envPath = path.resolve(__dirname, '../.env.test');
dotenv.config({ path: envPath });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://basha_vara_user:local_dev_password_change_me@localhost:5433/basha_vara_test?schema=public';
process.env.DIRECT_URL = process.env.DIRECT_URL || 'postgresql://basha_vara_user:local_dev_password_change_me@localhost:5433/basha_vara_test?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_testing_only';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_for_testing_only';
process.env.EMAIL_FROM = process.env.EMAIL_FROM || 'test@example.com';
process.env.BREVO_API_KEY = process.env.BREVO_API_KEY || 'test_brevo_key';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Now import TestDatabase after environment variables are set
const { TestDatabase } = await import('./helpers/test-database.js');

// E2E test setup - requires database
beforeAll(async () => {
  // Setup test database (requires running database)
  try {
    await TestDatabase.setup();
  } catch (error) {
    console.warn('Test database setup failed:', error);
    console.warn('E2E tests may fail without database');
  }
});

afterAll(async () => {
  // Cleanup after all E2E tests
  try {
    await TestDatabase.cleanup();
    await TestDatabase.disconnect();
  } catch (error) {
    console.warn('Test database cleanup failed:', error);
  }
});

beforeEach(async () => {
  // Reset test data before each E2E test
  try {
    await TestDatabase.cleanup();
    await TestDatabase.seed();
  } catch (error) {
    console.warn('Test data reset failed:', error);
  }
});

afterEach(async () => {
  // Cleanup after each E2E test
  try {
    await TestDatabase.cleanup();
  } catch (error) {
    console.warn('Test cleanup failed:', error);
  }
});
