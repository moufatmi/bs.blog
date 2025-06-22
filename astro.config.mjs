// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: 'https://moufatmi.github.io/Bs.blog', // Make sure 'blog-bs' here matches your repo name
  base: '/Bs.blog/', // <--- THIS IS THE CRUCIAL PART TO CHANGE
  integrations: [tailwind()],
});