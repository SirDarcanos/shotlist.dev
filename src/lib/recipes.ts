/**
 * The recipes shown on the site, read from the recipe files themselves.
 *
 * They used to be strings in this module, which meant the site could show a recipe that
 * would not parse, and did once. The site's own recipes run through `npm run shots`; the Ledger
 * recipe runs against the example application through `npm run demo:generate`.
 * `scripts/check-examples.mjs` parses both sets during an ordinary build, so every displayed
 * recipe remains a real input.
 *
 * Imported with `?raw` rather than read with `fs`: the bundler resolves the path at build
 * time, where `import.meta.url` would point at whichever chunk this ends up in.
 */
import anatomy from '../../screenshots/recipes/recipe-anatomy.yaml?raw'
import orderRow from '../../screenshots/demo/order-row.yaml?raw'
import config from '../../shotlist.config.yaml?raw'

/** The hero: the recipe for a shot of this site's own docs page. */
export const heroRecipe = anatomy.trimEnd()

/** The canonical Ledger demonstration shown beside the image it generates. */
export const ledgerRecipe = orderRow.trimEnd()

/** This project's own config. */
export const configExample = config.trimEnd()
