// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
  site: 'https://beausejourvoyage.com',
  base: '/',  // Root path for custom domain
  build: {
    assets: 'assets'
  }
});