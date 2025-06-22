// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: 'https://blog.beausejourvoyage.com',
  output: 'static',
  integrations: [tailwind()],
  build: {
    assets: '_astro',
  },
  trailingSlash: 'never',
});