import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import markdoc from '@astrojs/markdoc';

export default defineConfig({
  integrations: [tailwind(), react(), keystatic(), markdoc()],
  site: 'https://beausejourvoyage.com',
  output: 'static',
  build: {
    inlineStylesheets: 'never'
  }
});