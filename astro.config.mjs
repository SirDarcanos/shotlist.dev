// @ts-check
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import sitemap from '@astrojs/sitemap'

// `site` is what the sitemap and the canonical URLs are built from, so it is the real
// origin rather than a placeholder.
export default defineConfig({
  site: 'https://shotlist.dev',
  // Astro compresses HTML by default, and its idea of insignificant whitespace includes
  // the newline between a word and the `<code>` after it — so prose written across lines
  // came out with the spaces missing. Sixty-nine of them, before this was noticed.
  compressHTML: false,
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
})
