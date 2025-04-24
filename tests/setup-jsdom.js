// Setup file for JSDOM test environment

// Global setup for all tests
beforeAll(() => {
  // Any global setup needed for JSDOM tests
  // Set up a basic HTML structure
  document.body.innerHTML = `
    <div id="root"></div>
  `;
});

// Global teardown for all tests
afterAll(() => {
  // Any global teardown needed for JSDOM tests
});
