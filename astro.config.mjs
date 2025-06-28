// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import icon from "astro-icon";
import partytown from "@astrojs/partytown";

export default defineConfig({
  site: 'https://beausejourvoyage.com',
  output: 'static',
  integrations: [tailwind(), icon({
    include: {
      mdi: ["*"]
    }
  }), partytown()],
  build: {
    assets: '_astro',
  },
  trailingSlash: 'never',
});