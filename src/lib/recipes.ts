/**
 * Recipes shown on the site.
 *
 * These are written against the real schema and would parse today — the shots they
 * describe are not taken yet, so nothing here is claimed to be generated. When the site
 * shoots itself, these strings get read from the recipe files instead of living here.
 */

/** The hero: the recipe for a shot of this site's own docs page. */
export const heroRecipe = `# The shot at the top of this page, described in full.
name: recipe-anatomy
install: site

setup:
  - click: { role: link, name: Docs }
  - wait: { css: '[data-recipe]' }

clip:
  css: '[data-recipe]'
  pad: 24

marks:
  drive:  { within: clip, text: 'setup:' }
  region: { within: clip, text: 'clip:' }
  draw:   { within: clip, text: 'callouts:' }

callouts:
  - { mark: drive,  text: Drive the page, place: left }
  - { mark: region, text: Clip a region,  place: left }
  - { mark: draw,   text: Draw on top,    place: right }
`

/** The four-line version, for the "how it works" walk-through. */
export const minimalRecipe = `name: order-row
install: guide

clip: { css: '.order-row', contains: Acme Corp, pad: 20 }

marks:
  amount: { within: clip, text: $42.00 }

callouts:
  - { mark: amount, text: What they owe, place: left }
`

/** A project's config, for the install section. */
export const configExample = `site:
  url: http://localhost:3000
  viewport: { width: 1440, height: 900 }
  scale: 2

install:
  guide: content/guide/images
`
