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

function fontPreloads(html) {
  return (html.match(/<link\b[^>]*>/gi) ?? []).filter((tag) => {
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1]
    const as = tag.match(/\bas=["']([^"']+)["']/i)?.[1]
    return rel?.split(/\s+/).includes('preload') && as === 'font'
  })
}

const expectedRoutes = new Set(canonicalRoutes)
const builtFiles = await filesBelow(dist)
const htmlFiles = builtFiles.filter((filename) => filename.endsWith('.html'))
const css = (
  await Promise.all(
    builtFiles
      .filter((filename) => filename.endsWith('.css'))
      .map((filename) => readFile(filename, 'utf8')),
  )
).join('\n')
for (const family of [
  'Fraunces fallback',
  'Fraunces Android fallback',
  'Fraunces Windows fallback',
  'Inter fallback',
  'Inter Android fallback',
  'Inter Noto fallback',
  'JetBrains Mono fallback',
  'JetBrains Mono Android fallback',
  'JetBrains Mono Noto fallback',
]) {
  const face = css.match(new RegExp(`@font-face\\{font-family:${family};[^}]+\\}`))?.[0]
  if (!face) {
    fail(`built CSS is missing ${family}`)
    continue
  }
  for (const descriptor of ['size-adjust:', 'ascent-override:', 'descent-override:']) {
    if (!face.includes(descriptor)) fail(`${family} is missing ${descriptor.slice(0, -1)}`)
  }
}
const actualRoutes = new Set()
const documents = new Map()
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
  documents.set(route, html)
  const expectedCanonical = `${siteOrigin}${route}`
  if (canonicals.length !== 1 || canonicals[0] !== expectedCanonical) {
    fail(`${route} must have one canonical link to ${expectedCanonical}`)
  }

  if (route === '/' || route === '/docs/') {
    const externalStyles = linkHrefs(html, 'stylesheet').filter((href) => /^https?:/.test(href))
    if (externalStyles.length) fail(`${route} loads a third-party stylesheet`)

    const preloads = fontPreloads(html)
    if (preloads.length !== 3) fail(`${route} must preload its three above-the-fold fonts`)
    for (const preload of preloads) {
      if (!/\bcrossorigin(?:=["'][^"']*["'])?(?:\s|\/?>)/i.test(preload)) {
        fail(`${route} font preload must carry crossorigin`)
      }
      if (!/\btype=["']font\/woff2["']/i.test(preload)) {
        fail(`${route} font preload must declare font/woff2`)
      }
    }
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

  if (route.startsWith('/docs/')) {
    const currentLinks = html.match(/<a\b[^>]*\baria-current=["']page["'][^>]*>/gi) ?? []
    if (currentLinks.length !== 1) {
      fail(`${route} must expose exactly one current documentation link`)
    } else {
      const currentHref = currentLinks[0].match(/\bhref=["']([^"']+)["']/i)?.[1]
      if (currentHref !== route) fail(`${route} marks ${currentHref ?? 'no link'} as current`)
    }

    const headingIds = (html.match(/<h2\b[^>]*\bid=["'][^"']+["'][^>]*>/gi) ?? []).map(
      (heading) => heading.match(/\bid=["']([^"']+)["']/i)?.[1],
    )
    const headingCount = html.match(/<h2\b[^>]*>/gi)?.length ?? 0
    if (headingIds.length !== headingCount) fail(`${route} has an h2 without a stable fragment id`)
    if (new Set(headingIds).size !== headingIds.length)
      fail(`${route} has duplicate h2 fragment ids`)

    const toc = html.match(/<ul\b[^>]*\bclass=["'][^"']*\bpage-toc\b[^"']*["'][^>]*>(.*?)<\/ul>/i)
    const tocHrefs = toc ? valuesFor(toc[1], 'a', 'href') : []
    if (headingCount > 1 && tocHrefs.length !== headingCount) {
      fail(`${route} must link to every h2 from its section navigation`)
    }
    if (tocHrefs.some((href) => !href.startsWith('#') || !headingIds.includes(href.slice(1)))) {
      fail(`${route} section navigation contains a broken fragment`)
    }
  }
}

for (const [route, html] of documents) {
  for (const href of valuesFor(html, 'a', 'href')) {
    const url = new URL(href, `${siteOrigin}${route}`)
    if (url.origin !== siteOrigin || !url.hash) continue
    const target = documents.get(url.pathname)
    if (!target) continue
    const id = decodeURIComponent(url.hash.slice(1))
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (!new RegExp(`\\bid=["']${escaped}["']`, 'i').test(target)) {
      fail(`${route} links to missing fragment ${href}`)
    }
  }
}

if (!saw404) fail('dist/404.html is missing')

const ledgerAsset = '/images/order-row.png'
const ledgerFilename = path.join(dist, ledgerAsset.slice(1))
let ledgerImage
try {
  ledgerImage = await readFile(ledgerFilename)
} catch {
  fail(`${ledgerAsset} is missing from the production build`)
}
if (ledgerImage) {
  const pngSignature = '89504e470d0a1a0a'
  if (ledgerImage.subarray(0, 8).toString('hex') !== pngSignature) {
    fail(`${ledgerAsset} must be a PNG image`)
  } else {
    const width = ledgerImage.readUInt32BE(16)
    const height = ledgerImage.readUInt32BE(20)
    if (width !== 1652 || height !== 446) {
      fail(`${ledgerAsset} must be the canonical 1652×446 Ledger output, got ${width}×${height}`)
    }
  }
}

for (const route of ['/', '/docs/tutorials/first-screenshot/']) {
  const html = documents.get(route)
  if (!html) continue
  const imageTags = (html.match(/<img\b[^>]*>/gi) ?? []).filter((tag) =>
    tag.includes(`src="${ledgerAsset}"`),
  )
  if (imageTags.length !== 1) {
    fail(`${route} must show the canonical Ledger output once`)
    continue
  }
  if (!/\balt=["'][^"']+["']/i.test(imageTags[0])) {
    fail(`${route} Ledger output must have concise alt text`)
  }
  if (!/<figure\b[^>]*>[\s\S]*?\/images\/order-row\.png[\s\S]*?<figcaption\b/i.test(html)) {
    fail(`${route} Ledger output must appear in a figure with a visible caption`)
  }
}

const keepingCurrentRoute = '/docs/tutorials/keeping-a-screenshot-current/'
const keepingCurrent = documents.get(keepingCurrentRoute)
const driftAssets = new Map([
  ['/images/keeping-current/committed.png', [1652, 446]],
  ['/images/keeping-current/changed.png', [1652, 446]],
  ['/images/keeping-current/diff.png', [4980, 446]],
])
let committedDriftImage
for (const [asset, [expectedWidth, expectedHeight]] of driftAssets) {
  let image
  try {
    image = await readFile(path.join(dist, asset.slice(1)))
  } catch {
    fail(`${asset} is missing from the production build`)
    continue
  }
  if (asset.endsWith('/committed.png')) committedDriftImage = image
  if (image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    fail(`${asset} must be a PNG image`)
    continue
  }
  const width = image.readUInt32BE(16)
  const height = image.readUInt32BE(20)
  if (width !== expectedWidth || height !== expectedHeight) {
    fail(`${asset} must be ${expectedWidth}×${expectedHeight}, got ${width}×${height}`)
  }

  if (!keepingCurrent) continue
  const imageTags = (keepingCurrent.match(/<img\b[^>]*>/gi) ?? []).filter((tag) =>
    tag.includes(`src="${asset}"`),
  )
  if (imageTags.length !== 1) {
    fail(`${keepingCurrentRoute} must show ${asset} once`)
    continue
  }
  const widthAttribute = imageTags[0].match(/\bwidth=["'](\d+)["']/i)?.[1]
  const heightAttribute = imageTags[0].match(/\bheight=["'](\d+)["']/i)?.[1]
  if (widthAttribute !== String(expectedWidth) || heightAttribute !== String(expectedHeight)) {
    fail(`${keepingCurrentRoute} must declare ${asset} at ${expectedWidth}×${expectedHeight}`)
  }
  const figures = (keepingCurrent.match(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi) ?? []).filter(
    (figure) => figure.includes(`src="${asset}"`),
  )
  if (figures.length !== 1 || !/<figcaption\b/i.test(figures[0])) {
    fail(`${asset} must appear in one figure with a visible caption`)
  }
}
if (ledgerImage && committedDriftImage && committedDriftImage.compare(ledgerImage) !== 0) {
  fail('/images/keeping-current/committed.png must match the Ledger image installed by shotlist')
}

const homepage = documents.get('/')
if (homepage) {
  const category = 'Annotated screenshot automation for product documentation.'
  if (!homepage.includes(category)) fail(`homepage must state the product category: ${category}`)
  const expectedDescription =
    'Annotated screenshot automation from YAML for product documentation. shotlist drives a running site, clips a region, draws callouts, and writes the image.'
  if (metaContent(homepage, 'description') !== expectedDescription) {
    fail('homepage search description must name annotated screenshot automation from YAML')
  }
  if (
    !/<a\b[^>]*href=["']\/docs\/tutorials\/first-screenshot\/["'][^>]*class=["'][^"']*bg-mark/i.test(
      homepage,
    )
  ) {
    fail('homepage primary action must lead to the first tutorial')
  }
  if (!homepage.includes('Or install shotlist now:') || !homepage.includes('data-command-tabs')) {
    fail('homepage must retain the install command as a secondary path')
  }
}

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
