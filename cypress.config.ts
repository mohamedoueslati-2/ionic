import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    setupNodeEvents(on) {
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'electron') {
          launchOptions.preferences.width = 1600;
          launchOptions.preferences.height = 1100;
        }
        return launchOptions;
      });
    },
  },
});
