import { defineConfig } from "astro/config";

import vercel from "@astrojs/vercel";

export default defineConfig({
  i18n: {
    locales: ["en", "tr", "es"],
    defaultLocale: "en",
    routing: {
      prefixDefaultLocale: true,
    },
  },

  adapter: vercel(),
});