import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import markdoc from '@astrojs/markdoc';

export default defineConfig({
  integrations: [
    tailwind(),
    react(),
    ...(process.env.NODE_ENV === 'development' ? [keystatic()] : []),
    markdoc()
  ],
  site: 'https://beausejourvoyage.com',
  output: 'static',
  image: {
    domains: ['i.imgur.com', 'imgur.com', 'upload.wikimedia.org'],
  },
  build: {
    inlineStylesheets: 'always'
  }
});