import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { canonicalRoutes, legacyRedirects, siteOrigin } from './route-contract.mjs'

const dist = path.resolve('dist')
const failures = []

function fail(message) {
  failures.push(message)
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const filename = path.join(directory, entry.name)
      return entry.isDirectory() ? filesBelow(filename) : filename
    }),
  )
  return files.flat()
}

function routeFor(filename) {
  const relative = path.relative(dist, filename).split(path.sep).join('/')
  if (relative === 'index.html') return '/'
  return `/${relative.replace(/index\.html$/, '')}`
}

function valuesFor(html, element, attribute) {
  const values = []
  const pattern = new RegExp(`<${element}\\b[^>]*\\b${attribute}=["']([^"']+)["'][^>]*>`, 'gi')
  for (const match of html.matchAll(pattern)) values.push(match[1])
  return values
}

function metaContent(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    const metaName = tag.match(/\bname=["']([^"']+)["']/i)?.[1]
    if (metaName?.toLowerCase() === name) return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1]
  }
}

function linkHrefs(html, rel) {
  const hrefs = []
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const relation = tag.match(/\brel=["']([^"']+)["']/i)?.[1]
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1]
    if (relation?.split(/\s+/).includes(rel) && href) hrefs.push(href)
  }
  return hrefs
}

const expectedRoutes = new Set(canonicalRoutes)
const htmlFiles = (await filesBelow(dist)).filter((filename) => filename.endsWith('.html'))
const actualRoutes = new Set()
let saw404 = false

for (const filename of htmlFiles) {
  const route = routeFor(filename)
  const html = await readFile(filename, 'utf8')
  const robots = metaContent(html, 'robots')
  const canonicals = linkHrefs(html, 'canonical')
  const noindex = robots?.split(',').some((value) => value.trim().toLowerCase() === 'noindex')

  if (route === '/404.html') {
    saw404 = true
    if (!noindex) fail('404.html must carry a noindex robots directive')
    if (canonicals.length) fail('404.html must not carry a canonical link')
    continue
  }

  if (route === '/og/') {
    if (!noindex) fail('/og/ must carry a noindex robots directive')
    continue
  }

  if (noindex) {
    fail(`${route} is in the canonical route inventory but carries noindex`)
    continue
  }

  actualRoutes.add(route)
  const expectedCanonical = `${siteOrigin}${route}`
  if (canonicals.length !== 1 || canonicals[0] !== expectedCanonical) {
    fail(`${route} must have one canonical link to ${expectedCanonical}`)
  }

  for (const href of valuesFor(html, 'a', 'href')) {
    if (!href.startsWith('/')) continue
    const url = new URL(href, siteOrigin)
    const linkedPath = url.pathname
    if (/\.[^/]+$/.test(linkedPath)) continue
    if (linkedPath !== '/' && !linkedPath.endsWith('/')) {
      fail(`${route} links to non-canonical internal path ${href}`)
      continue
    }
    if (!expectedRoutes.has(linkedPath)) fail(`${route} links to missing internal path ${href}`)
  }
}

if (!saw404) fail('dist/404.html is missing')

for (const route of expectedRoutes) {
  if (!actualRoutes.has(route)) fail(`canonical route is missing from dist: ${route}`)
}
for (const route of actualRoutes) {
  if (!expectedRoutes.has(route)) fail(`unexpected canonical route in dist: ${route}`)
}

const sitemapFiles = (await filesBelow(dist)).filter((filename) =>
  /sitemap-\d+\.xml$/.test(filename),
)
const sitemapLocations = new Set()
for (const filename of sitemapFiles) {
  const xml = await readFile(filename, 'utf8')
  for (const [, location] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    if (sitemapLocations.has(location)) fail(`duplicate sitemap location: ${location}`)
    sitemapLocations.add(location)
  }
}
const sitemapRoutes = new Set(
  [...sitemapLocations].map((location) => {
    const url = new URL(location)
    if (url.origin !== siteOrigin) fail(`sitemap contains another origin: ${location}`)
    if (url.search || url.hash) fail(`sitemap contains a query or fragment: ${location}`)
    return url.pathname
  }),
)
for (const route of expectedRoutes) {
  const location = `${siteOrigin}${route}`
  if (!sitemapLocations.has(location)) fail(`canonical route is missing from the sitemap: ${route}`)
}
for (const location of sitemapLocations) {
  if (!expectedRoutes.has(new URL(location).pathname)) {
    fail(`non-canonical route is present in the sitemap: ${location}`)
  }
}

const redirectText = await readFile(path.join(dist, '_redirects'), 'utf8')
const redirectRules = redirectText
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split(/\s+/))
const actualRedirects = new Map()
for (const [source, destination, status, ...extra] of redirectRules) {
  if (!source || !destination || !status || extra.length) {
    fail(
      `invalid redirect rule: ${[source, destination, status, ...extra].filter(Boolean).join(' ')}`,
    )
    continue
  }
  if (status !== '301' && status !== '308') fail(`${source} must use a permanent redirect status`)
  if (actualRedirects.has(source)) fail(`duplicate redirect source: ${source}`)
  actualRedirects.set(source, destination)
}

for (const [source, destination] of Object.entries(legacyRedirects)) {
  for (const variant of [source, `${source}/`]) {
    if (actualRedirects.get(variant) !== destination) {
      fail(`${variant} must redirect directly to ${destination}`)
    }
  }
}
for (const [source, destination] of actualRedirects) {
  const baseSource = source.endsWith('/') ? source.slice(0, -1) : source
  if (legacyRedirects[baseSource] !== destination) fail(`unexpected redirect rule: ${source}`)
  if (!destination.endsWith('/')) fail(`${source} redirects to non-canonical path ${destination}`)
  if (!expectedRoutes.has(destination)) fail(`${source} redirects to missing path ${destination}`)
  if (actualRoutes.has(source) || sitemapRoutes.has(source)) {
    fail(`redirect source also appears in the canonical inventory: ${source}`)
  }
}

if (failures.length) {
  console.error(
    `Site contract failed with ${failures.length} error${failures.length === 1 ? '' : 's'}:`,
  )
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(
    `Site contract holds for ${actualRoutes.size} canonical routes and ${actualRedirects.size} redirects.`,
  )
}
