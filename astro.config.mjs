// @ts-check
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import sitemap from '@astrojs/sitemap'

// `site` is what the sitemap and the canonical URLs are built from, so it is the real
// origin rather than a placeholder.
export default defineConfig({
  site: 'https://shotlist.dev',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
})
