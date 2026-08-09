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
  /*
   * The docs were eleven flat pages before they were four Diátaxis folders, and those
   * eleven URLs are printed in the package's README and in the skill it ships — both
   * already published to npm, where no edit here can reach them. These keep every link in
   * a released version working.
   *
   * A reader arriving at one of these wanted a topic, not a quadrant, so each lands on
   * whichever page now answers the question it used to.
   */
  redirects: {
    '/docs/install': '/docs/how-to/install',
    '/docs/config': '/docs/reference/configuration',
    '/docs/recipes': '/docs/reference/recipe',
    '/docs/steps': '/docs/reference/steps',
    '/docs/queries': '/docs/reference/queries',
    '/docs/callouts': '/docs/reference/callouts',
    '/docs/macros': '/docs/reference/macros-and-data',
    '/docs/running-shotlist': '/docs/reference/cli',
    '/docs/check': '/docs/tutorials/keeping-a-screenshot-current',
    '/docs/security': '/docs/explanation/security-model',
  },
  // `/og` exists only to be photographed into the card, so it is not a page to index.
  integrations: [sitemap({ filter: (page) => !page.endsWith('/og/') })],
  vite: {
    plugins: [tailwindcss()],
  },
})
