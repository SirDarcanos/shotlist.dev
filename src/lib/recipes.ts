/**
 * The recipes shown on the site, read from the recipe files themselves.
 *
 * They used to be strings in this module, which meant the site could show a recipe that
 * would not parse, and did once. These are the files `npm run shots` runs, checked by
 * `scripts/check-examples.mjs` against the same schemas that validate a real run — so a
 * recipe on the page is one that works, or the build fails.
 *
 * Imported with `?raw` rather than read with `fs`: the bundler resolves the path at build
 * time, where `import.meta.url` would point at whichever chunk this ends up in.
 */
import anatomy from '../../screenshots/recipes/recipe-anatomy.yaml?raw'
import orderRow from '../../screenshots/recipes/order-row.yaml?raw'
import config from '../../shotlist.config.yaml?raw'

/** The hero: the recipe for a shot of this site's own docs page. */
export const heroRecipe = anatomy.trimEnd()

/** The four-line version, for the "how it works" walk-through. */
export const minimalRecipe = orderRow.trimEnd()

/** This project's own config. */
export const configExample = config.trimEnd()
