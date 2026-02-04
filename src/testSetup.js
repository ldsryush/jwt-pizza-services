// Global test setup and teardown

// Increase timeout for all tests to account for database operations
jest.setTimeout(30000);

// Global teardown to ensure database connections are closed
afterAll(async () => {
  // Give time for all connections to close
  await new Promise(resolve => setTimeout(resolve, 500));
});
