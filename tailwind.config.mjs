/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,js,ts,jsx,tsx}"],

  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        gold: '#D4AF37',
        'brand-teal': '#1ba4ae',
        'brand-cyan': '#22c5d4',
        cream: '#F5F5DC',
        'warm-beige': '#F7F3E9',
      },
      
      fontFamily: {
        arabic: ['Amiri', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}