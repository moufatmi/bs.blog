// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";

export default defineConfig({
  site: 'https://blog.beausejourvoyage.com',
  output: 'static',
  integrations: [tailwind(), icon({
    include: {
      mdi: ["*"]
    }
  })],
  build: {
    assets: '_astro',
  },
  trailingSlash: 'never',
});