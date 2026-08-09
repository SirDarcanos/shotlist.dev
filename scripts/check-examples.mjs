/**
 * Parse every YAML on the site with shotlist's own schemas.
 *
 * The docs are hand-written prose, so nothing was checking that the examples in them
 * would actually run — and one did not: a `- comment:` on its own, which is a modifier
 * rather than a step. This runs in `npm run build`, so a snippet the schema would refuse
 * fails the build rather than shipping.
 *
 * Two kinds of YAML are checked: the recipe files the site shoots itself with, and the
 * fenced examples on the docs pages. A snippet is judged by what it starts with — a
 * top-level config key is a config, anything else is a recipe or a query.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Macro, parseConfig, parseQuery, parseRecipe } from 'shotlist'
import { parse } from 'yaml'

const DOCS = 'src/pages/docs'
const RECIPES = 'screenshots/recipes'
const CONFIG_KEYS = [
  'site:',
  'paths:',
  'install:',
  'finders:',
  'style:',
  'deny:',
  'allowEnv:',
  'check:',
  'image:',
]

let failures = 0
const fail = (label, error) => {
  console.error(`  ✗ ${label}: ${error.message.replace(/\n\s*/g, ' | ').slice(0, 160)}`)
  failures++
}

// The files a run would actually read.
const config = parseConfig(parse(readFileSync('shotlist.config.yaml', 'utf8')))
for (const file of readdirSync(RECIPES).filter((f) => f.endsWith('.yaml'))) {
  try {
    parseRecipe(parse(readFileSync(join(RECIPES, file), 'utf8')), {
      name: file.replace(/\.yaml$/, ''),
      finders: config.finders,
    })
  } catch (error) {
    fail(`${RECIPES}/${file}`, error)
  }
}

// The examples on the pages. The docs are one folder per Diátaxis quadrant, so this walks.
const pages = readdirSync(DOCS, { recursive: true }).filter((f) => String(f).endsWith('.astro'))

for (const file of pages) {
  const source = readFileSync(join(DOCS, file), 'utf8')

  // Which consts are rendered as something other than YAML.
  const notYaml = new Set(
    [...source.matchAll(/<RecipeCard\s+code=\{(\w+)\}[^>]*lang="(bash|ts|css)"/g)].map((m) => m[1]),
  )

  // Every finder defined anywhere on the page, so a snippet that calls one resolves.
  const finders = { ...config.finders }
  for (const [, body] of source.matchAll(/^const \w+ = `([\s\S]*?)`$/gm)) {
    try {
      const parsed = parse(body)
      if (parsed?.finders) Object.assign(finders, parsed.finders)
    } catch {
      // Not YAML; nothing to take from it.
    }
  }

  for (const [, name, body] of source.matchAll(/^const (\w+) = `([\s\S]*?)`$/gm)) {
    if (notYaml.has(name)) continue
    // A `raw…` name is YAML that is not shotlist's — a CI workflow, an editor setting. It is
    // still parsed as YAML, so a broken one fails, but no shotlist schema is applied to it.
    const raw = /^raw[A-Z]/.test(name)
    const label = `${file} → ${name}`
    let doc
    try {
      doc = parse(body)
    } catch (error) {
      fail(label, error)
      continue
    }
    // A data file is a list or a plain mapping of values, not a document any schema describes.
    if (raw || Array.isArray(doc)) continue
    if (doc === null || typeof doc !== 'object') continue

    const isConfig = CONFIG_KEYS.some((key) => body.trimStart().startsWith(key)) && !('name' in doc)
    const isMacro = 'steps' in doc && !('clip' in doc) && !('setup' in doc)
    try {
      if (isMacro) Macro.parse(doc)
      // A fragment shows one section, so it is merged into a config rather than being one.
      else if (isConfig) parseConfig({ ...doc, site: { url: 'http://x', ...(doc.site ?? {}) } })
      else if ('span' in doc || 'rect' in doc || 'css' in doc) parseQuery(doc, finders)
      else parseRecipe(doc, { name: 'example', finders })
    } catch (error) {
      fail(label, error)
    }
  }
}

if (failures) {
  console.error(`\n${failures} example(s) would not parse`)
  process.exit(1)
}
console.log('  examples parse against shotlist’s own schemas')
