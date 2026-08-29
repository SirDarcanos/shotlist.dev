// @ts-check
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import sitemap from '@astrojs/sitemap'
import { docsProvenance } from './src/lib/docs-provenance.mjs'

// `site` is what the sitemap and the canonical URLs are built from, so it is the real
// origin rather than a placeholder.
export default defineConfig({
  site: 'https://shotlist.dev',
  // Astro compresses HTML by default, and its idea of insignificant whitespace includes
  // the newline between a word and the `<code>` after it — so prose written across lines
  // came out with the spaces missing. Sixty-nine of them, before this was noticed.
  compressHTML: false,
  trailingSlash: 'always',
  // `/og` and its topic variants exist only to be photographed, so none enters the sitemap.
  integrations: [
    sitemap({
      filter: (page) => !new URL(page).pathname.startsWith('/og/'),
      serialize(item) {
        const provenance = docsProvenance(new URL(item.url).pathname)
        return provenance?.modified ? { ...item, lastmod: provenance.modified } : item
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
