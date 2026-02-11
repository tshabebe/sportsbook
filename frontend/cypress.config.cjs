const { defineConfig } = require('cypress');

module.exports = defineConfig({
  screenshotOnRunFailure: false,
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.{ts,tsx,js,jsx}',
    supportFile: false,
    video: false,
  },
});
