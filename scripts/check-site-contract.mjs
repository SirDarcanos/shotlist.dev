import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { canonicalRoutes, legacyRedirects, siteOrigin } from './route-contract.mjs'

const dist = path.resolve('dist')
const failures = []
const shotlistMetadata = JSON.parse(
  await readFile(path.resolve('node_modules/shotlist/package.json'), 'utf8'),
)
const sourceRepository = 'https://github.com/SirDarcanos/shotlist.dev'

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

function attributeValue(tag, attribute) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return tag
    .match(new RegExp(`\\b${escaped}=(?:"([^"]*)"|'([^']*)')`, 'i'))
    ?.slice(1)
    .find(Boolean)
}

function metaContent(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    const metaName = attributeValue(tag, 'name')
    if (metaName?.toLowerCase() === name) {
      const content = attributeValue(tag, 'content')
      return content === undefined ? undefined : visibleText(content)
    }
  }
}

function metaProperty(html, property) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    const metaProperty = attributeValue(tag, 'property')
    if (metaProperty?.toLowerCase() === property) {
      const content = attributeValue(tag, 'content')
      return content === undefined ? undefined : visibleText(content)
    }
  }
}

function linkHrefs(html, rel, type) {
  const hrefs = []
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const relation = tag.match(/\brel=["']([^"']+)["']/i)?.[1]
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1]
    const contentType = tag.match(/\btype=["']([^"']+)["']/i)?.[1]
    if (relation?.split(/\s+/).includes(rel) && href && (!type || contentType === type)) {
      hrefs.push(href)
    }
  }
  return hrefs
}

function markdownRouteFor(route) {
  return route === '/' ? '/index.md' : `${route.slice(0, -1)}.md`
}

function containsProperty(value, property) {
  if (!value || typeof value !== 'object') return false
  if (Object.hasOwn(value, property)) return true
  return Object.values(value).some((child) => containsProperty(child, property))
}

function jsonLdNodes(route, html) {
  const nodes = []
  const scripts =
    html.match(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? []
  for (const script of scripts) {
    const source = script.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '')
    let document
    try {
      document = JSON.parse(source)
    } catch (error) {
      fail(`${route} contains invalid JSON-LD: ${error.message}`)
      continue
    }
    if (document['@context'] !== 'https://schema.org') {
      fail(`${route} JSON-LD must use the Schema.org context`)
    }
    for (const unsupported of ['aggregateRating', 'review', 'offers']) {
      if (containsProperty(document, unsupported)) {
        fail(`${route} structured data must not claim ${unsupported}`)
      }
    }
    nodes.push(...(Array.isArray(document['@graph']) ? document['@graph'] : [document]))
  }
  return nodes
}

function schemaType(node, type) {
  return (Array.isArray(node['@type']) ? node['@type'] : [node['@type']]).includes(type)
}

function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

function docsSourcePath(route) {
  return route === '/docs/' ? 'src/pages/docs/index.astro' : `src/pages${route.slice(0, -1)}.astro`
}

function visibleText(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function markdownVisibleText(markdown) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`+([^`]*)`+/g, '$1')
    .replace(/[~*_]/g, '')
    .replace(/\\([\\[\]])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function markdownHeadings(markdown) {
  const headings = []
  let fence
  for (const line of markdown.split('\n')) {
    const openingFence = line.match(/^\s*(`{3,})/)
    if (openingFence) {
      if (!fence) fence = openingFence[1]
      else if (openingFence[1].length >= fence.length) fence = undefined
      continue
    }
    if (fence) continue
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/)
    if (heading) headings.push({ level: heading[1].length, label: markdownVisibleText(heading[2]) })
  }
  return headings
}

function headerRules(text) {
  const rules = new Map()
  let route
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    if (!line.startsWith(' ') && line.startsWith('/')) {
      route = line.trim()
      rules.set(route, new Map())
      continue
    }
    const match = line.match(/^\s+([^:]+):\s*(.+)$/)
    if (route && match) rules.get(route).set(match[1].toLowerCase(), match[2])
  }
  return rules
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
const docsModificationDates = new Map()
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

  if (route.startsWith('/og/')) {
    if (!noindex) fail(`${route} must carry a noindex robots directive`)
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
  const markdownRoute = markdownRouteFor(route)
  const markdownAlternates = linkHrefs(html, 'alternate', 'text/markdown')
  if (
    markdownAlternates.length !== 1 ||
    markdownAlternates[0] !== `${siteOrigin}${markdownRoute}`
  ) {
    fail(`${route} must advertise ${markdownRoute} as its text/markdown alternate`)
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

    const provenanceBlocks =
      html.match(/<aside\b[^>]*\bdata-doc-provenance\b[^>]*>[\s\S]*?<\/aside>/gi) ?? []
    if (provenanceBlocks.length !== 1) {
      fail(`${route} must expose one page provenance block`)
    } else {
      const provenance = provenanceBlocks[0]
      const openingTag = provenance.match(/^<aside\b[^>]*>/i)?.[0] ?? ''
      const history = attributeValue(openingTag, 'data-history')
      const version = attributeValue(openingTag, 'data-shotlist-version')
      const text = visibleText(provenance)
      if (
        version !== shotlistMetadata.version ||
        !text.includes(`shotlist ${shotlistMetadata.version}`)
      ) {
        fail(`${route} provenance must use the installed shotlist version`)
      }
      if (!text.includes(`Written by ${shotlistMetadata.author}`)) {
        fail(`${route} provenance must name the documentation author`)
      }
      if (!text.includes(`Maintained by ${shotlistMetadata.author}`)) {
        fail(`${route} provenance must name the package maintainer`)
      }

      const dates = [...provenance.matchAll(/<time\b[^>]*\bdatetime=["']([^"']+)["'][^>]*>/gi)].map(
        (match) => match[1],
      )
      for (const date of dates) {
        if (!validDate(date)) fail(`${route} provenance contains invalid date ${date}`)
      }
      if (history === 'complete') {
        if (dates.length !== 2) fail(`${route} complete provenance must publish two dates`)
        if (dates.length === 2 && dates[0] > dates[1]) {
          fail(`${route} publication date follows its modification date`)
        }
        docsModificationDates.set(route, dates[1])
      } else if (history === 'unavailable') {
        if (dates.length) fail(`${route} unavailable history must not publish guessed dates`)
        docsModificationDates.set(route, undefined)
      } else {
        fail(`${route} provenance must declare whether source history is complete`)
      }

      const sourcePath = docsSourcePath(route)
      const expectedLinks = [
        `${sourceRepository}/blob/main/${sourcePath}`,
        `${sourceRepository}/edit/main/${sourcePath}`,
      ]
      const provenanceLinks = valuesFor(provenance, 'a', 'href')
      for (const link of expectedLinks) {
        if (!provenanceLinks.includes(link)) fail(`${route} provenance is missing ${link}`)
      }
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

function checkCardMetadata(route, html, card, alt) {
  for (const [label, actual, expected] of [
    ['Open Graph image', metaProperty(html, 'og:image'), card],
    ['Open Graph image URL', metaProperty(html, 'og:image:url'), card],
    ['Open Graph image alt', metaProperty(html, 'og:image:alt'), alt],
    ['Open Graph image width', metaProperty(html, 'og:image:width'), '2400'],
    ['Open Graph image height', metaProperty(html, 'og:image:height'), '1260'],
    ['Open Graph image type', metaProperty(html, 'og:image:type'), 'image/png'],
    ['Twitter image', metaContent(html, 'twitter:image'), card],
    ['Twitter image alt', metaContent(html, 'twitter:image:alt'), alt],
  ]) {
    if (actual !== expected) fail(`${route} ${label} must be ${expected}`)
  }
}

const socialCards = new Map([
  ['/docs/', ['docs', 'Documentation']],
  ['/docs/tutorials/first-screenshot/', ['first-screenshot', 'Your first screenshot']],
  [
    '/docs/tutorials/keeping-a-screenshot-current/',
    ['keeping-a-screenshot-current', 'Keeping a screenshot current'],
  ],
  [
    '/docs/tutorials/document-a-wordpress-site/',
    ['document-a-wordpress-site', "Document a client's WordPress site"],
  ],
  ['/docs/how-to/run-in-ci/', ['run-in-ci', 'Run shotlist in CI']],
  ['/docs/how-to/annotate-an-image/', ['annotate-an-image', 'Annotate an existing image']],
])
const defaultCard = `${siteOrigin}/og.png`
for (const [route, [slug, title]] of socialCards) {
  const html = documents.get(route)
  if (!html) continue
  const card = `${siteOrigin}/social/${slug}.png`
  const alt = `shotlist documentation — ${title}`
  checkCardMetadata(route, html, card, alt)

  let image
  const asset = `/social/${slug}.png`
  try {
    image = await readFile(path.join(dist, asset.slice(1)))
  } catch {
    fail(`${asset} is missing from the production build`)
    continue
  }
  if (image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    fail(`${asset} must be a crawlable PNG image`)
    continue
  }
  const width = image.readUInt32BE(16)
  const height = image.readUInt32BE(20)
  if (width !== 2400 || height !== 1260) {
    fail(`${asset} must be 2400×1260, got ${width}×${height}`)
  }
}
const defaultCardAlt = 'shotlist — annotated UI screenshots, described as data'
for (const [route, html] of documents) {
  if (!socialCards.has(route)) checkCardMetadata(route, html, defaultCard, defaultCardAlt)
}
let defaultCardImage
try {
  defaultCardImage = await readFile(path.join(dist, 'og.png'))
} catch {
  fail('/og.png is missing from the production build')
}
if (defaultCardImage) {
  if (defaultCardImage.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    fail('/og.png must be a crawlable PNG image')
  } else {
    const width = defaultCardImage.readUInt32BE(16)
    const height = defaultCardImage.readUInt32BE(20)
    if (width !== 2400 || height !== 1260) {
      fail(`/og.png must be 2400×1260, got ${width}×${height}`)
    }
  }
}

const homepage = documents.get('/')
if (homepage) {
  const nodes = jsonLdNodes('/', homepage)
  const website = nodes.find((node) => schemaType(node, 'WebSite'))
  const software = nodes.find((node) => schemaType(node, 'SoftwareApplication'))
  if (!website || !software) {
    fail('homepage JSON-LD must describe WebSite and SoftwareApplication entities')
  } else {
    if (website.mainEntity?.['@id'] !== software['@id']) {
      fail('homepage WebSite must connect its main entity to the SoftwareApplication')
    }
    if (website.url !== siteOrigin || software.url !== siteOrigin) {
      fail('homepage structured entities must use the canonical site URL')
    }
    if (
      software.name !== shotlistMetadata.name ||
      software.author?.name !== shotlistMetadata.author
    ) {
      fail('homepage SoftwareApplication must use maintained package metadata')
    }
    if (software.softwareRequirements !== 'Node.js 20 or later' || software.operatingSystem) {
      fail(
        'homepage SoftwareApplication must describe Node.js as a requirement, not an operating system',
      )
    }
    if (software.description !== metaContent(homepage, 'description')) {
      fail('homepage SoftwareApplication description must match the visible search claim')
    }
    for (const unsupported of ['aggregateRating', 'review', 'offers']) {
      if (unsupported in software)
        fail(`homepage SoftwareApplication must not claim ${unsupported}`)
    }
  }
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
  if (
    !homepage.includes('Or install:') ||
    !homepage.includes('data-hero-install') ||
    !homepage.includes('npm i -D shotlist playwright')
  ) {
    fail('homepage must retain the npm install command as a secondary path')
  }
}

const howToRoutes = new Set([
  '/docs/tutorials/first-screenshot/',
  '/docs/tutorials/keeping-a-screenshot-current/',
  '/docs/tutorials/document-a-wordpress-site/',
  '/docs/how-to/annotate-an-image/',
  '/docs/how-to/install/',
  '/docs/how-to/run-in-ci/',
  '/docs/how-to/sign-in/',
])
for (const [route, html] of documents) {
  if (!route.startsWith('/docs/')) continue
  const nodes = jsonLdNodes(route, html)
  const breadcrumb = nodes.find((node) => schemaType(node, 'BreadcrumbList'))
  const article = nodes.find((node) => schemaType(node, 'TechArticle'))
  const howTo = nodes.find((node) => schemaType(node, 'HowTo'))
  const articleHtml = html.match(
    /<article\b[^>]*>([\s\S]*?)<aside\b[^>]*\bdata-doc-provenance/i,
  )?.[1]
  const visibleTitle = visibleText(articleHtml?.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '')
  const description = metaContent(html, 'description')
  const image = metaProperty(html, 'og:image')

  if (!breadcrumb || !article) {
    fail(`${route} JSON-LD must describe its BreadcrumbList and TechArticle`)
    continue
  }
  const visibleBreadcrumb = html.match(
    /<nav\b[^>]*\baria-label=["']Breadcrumb["'][^>]*>([\s\S]*?)<\/nav>/i,
  )?.[1]
  const visibleCrumbs = visibleBreadcrumb
    ? [
        ...visibleBreadcrumb.matchAll(
          /<(?:a|span)\b[^>]*\bdata-breadcrumb-name\b[^>]*>([\s\S]*?)<\/(?:a|span)>/gi,
        ),
      ].map((match) => visibleText(match[1]))
    : []
  const schemaCrumbs = (breadcrumb.itemListElement ?? []).map((item) => item.name)
  if (!visibleCrumbs.length || JSON.stringify(schemaCrumbs) !== JSON.stringify(visibleCrumbs)) {
    fail(`${route} BreadcrumbList must match its visible breadcrumb hierarchy`)
  }
  if (article.headline !== visibleTitle || article.description !== description) {
    fail(`${route} TechArticle title and description must agree with the page`)
  }
  if (article.url !== `${siteOrigin}${route}` || article.image !== image) {
    fail(`${route} TechArticle URL and image must agree with canonical page metadata`)
  }
  if (
    article.author?.name !== shotlistMetadata.author ||
    article.version !== shotlistMetadata.version
  ) {
    fail(`${route} TechArticle must use visible maintainer and version metadata`)
  }
  const sourcePath = docsSourcePath(route)
  if (article.isBasedOn !== `${sourceRepository}/blob/main/${sourcePath}`) {
    fail(`${route} TechArticle must identify its visible source`)
  }
  const provenance =
    html.match(/<aside\b[^>]*\bdata-doc-provenance\b[^>]*>[\s\S]*?<\/aside>/i)?.[0] ?? ''
  const dates = [...provenance.matchAll(/<time\b[^>]*\bdatetime=["']([^"']+)["'][^>]*>/gi)].map(
    (match) => match[1],
  )
  if (article.datePublished !== dates[0] || article.dateModified !== dates[1]) {
    fail(`${route} TechArticle dates must agree with visible provenance`)
  }

  if (howToRoutes.has(route)) {
    if (!howTo) fail(`${route} must describe its ordered procedure as HowTo`)
    else {
      const visibleSteps = [...(articleHtml ?? '').matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
        .map((match) => visibleText(match[1]))
        .filter((heading) => /^Step \d+:/.test(heading))
      const schemaSteps = (howTo.step ?? []).map((step) => step.name)
      if (JSON.stringify(schemaSteps) !== JSON.stringify(visibleSteps)) {
        fail(`${route} HowTo steps must follow the visible step order`)
      }
    }
  } else if (howTo) {
    fail(`${route} must not claim HowTo semantics without one ordered procedure`)
  }
}

for (const route of expectedRoutes) {
  if (!actualRoutes.has(route)) fail(`canonical route is missing from dist: ${route}`)
}
for (const route of actualRoutes) {
  if (!expectedRoutes.has(route)) fail(`unexpected canonical route in dist: ${route}`)
}

const headers = headerRules(await readFile(path.join(dist, '_headers'), 'utf8'))
for (const route of expectedRoutes) {
  const markdownRoute = markdownRouteFor(route)
  let markdown
  try {
    markdown = await readFile(path.join(dist, markdownRoute.slice(1)), 'utf8')
  } catch {
    fail(`${markdownRoute} is missing from the production build`)
    continue
  }

  const html = documents.get(route)
  const contentHtml = route.startsWith('/docs/')
    ? html?.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    : html?.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
  const title = contentHtml?.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
  if (!title || !markdown.startsWith(`# ${visibleText(title)}\n`)) {
    fail(`${markdownRoute} must preserve the visible page title`)
  }
  const sourceHeadings = [
    ...(contentHtml ?? '').matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi),
  ].map((match) => ({ level: Number(match[1]), label: visibleText(match[2]) }))
  const remainingHeadings = markdownHeadings(markdown)
  for (const sourceHeading of sourceHeadings) {
    const index = remainingHeadings.findIndex(
      (heading) => heading.level === sourceHeading.level && heading.label === sourceHeading.label,
    )
    if (index === -1) {
      fail(
        `${markdownRoute} must preserve its h${sourceHeading.level} heading: ${sourceHeading.label}`,
      )
    } else {
      remainingHeadings.splice(index, 1)
    }
  }
  const firstLink = contentHtml?.match(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i)?.[1]
  if (firstLink && !markdown.includes(`](${firstLink})`)) {
    fail(`${markdownRoute} must preserve its first content link`)
  }
  const firstImage = contentHtml?.match(/<img\b[^>]*>/i)?.[0]
  const firstImageAlt = firstImage?.match(/\balt=["']([^"']+)["']/i)?.[1]
  const firstImageSource = firstImage?.match(/\bsrc=["']([^"']+)["']/i)?.[1]
  if (
    firstImageAlt &&
    firstImageSource &&
    !markdown.includes(`![${firstImageAlt}](${firstImageSource})`)
  ) {
    fail(`${markdownRoute} must preserve meaningful image text`)
  }
  if (/<pre\b/i.test(contentHtml ?? '') && !/^```/m.test(markdown)) {
    fail(`${markdownRoute} must preserve code blocks`)
  }
  if (/<table\b/i.test(contentHtml ?? '') && !/^\| .* \|\n\|(?: --- \|)+$/m.test(markdown)) {
    fail(`${markdownRoute} must preserve tables`)
  }
  if (/<(?:ul|ol)\b/i.test(contentHtml ?? '') && !/^(?:- |\d+\. )/m.test(markdown)) {
    fail(`${markdownRoute} must preserve lists`)
  }
  for (const forbidden of ['Skip to content', 'Back to top', 'install_command_copied']) {
    if (markdown.includes(forbidden)) fail(`${markdownRoute} contains non-content UI: ${forbidden}`)
  }

  const rule = headers.get(markdownRoute)
  if (rule?.get('content-type') !== 'text/markdown; charset=utf-8') {
    fail(`${markdownRoute} must be served as UTF-8 text/markdown`)
  }
  if (rule?.get('x-robots-tag') !== 'noindex') {
    fail(`${markdownRoute} must carry an X-Robots-Tag: noindex header`)
  }
  const expectedLink = `<${siteOrigin}${route}>; rel="canonical"`
  if (rule?.get('link') !== expectedLink) {
    fail(`${markdownRoute} must identify ${siteOrigin}${route} as canonical`)
  }
}

const llms = await readFile(path.join(dist, 'llms.txt'), 'utf8')
const expectedLlmsAlternates = new Set(
  [...expectedRoutes].map((route) => `${siteOrigin}${markdownRouteFor(route)}`),
)
const actualLlmsAlternates = new Set(
  [...llms.matchAll(/\]\((https:\/\/shotlist\.dev\/[^)]*\.md)\)/g)].map((match) => match[1]),
)
for (const alternate of expectedLlmsAlternates) {
  if (!actualLlmsAlternates.has(alternate)) fail(`llms.txt is missing ${alternate}`)
}
for (const alternate of actualLlmsAlternates) {
  if (!expectedLlmsAlternates.has(alternate)) fail(`llms.txt lists unknown alternate ${alternate}`)
}
if (/there are no markdown versions/i.test(llms)) {
  fail('llms.txt still claims that Markdown alternates do not exist')
}

const sitemapFiles = (await filesBelow(dist)).filter((filename) =>
  /sitemap-\d+\.xml$/.test(filename),
)
const sitemapLocations = new Set()
const sitemapLastmods = new Map()
for (const filename of sitemapFiles) {
  const xml = await readFile(filename, 'utf8')
  for (const [, entry] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const location = entry.match(/<loc>([^<]+)<\/loc>/)?.[1]
    if (!location) {
      fail(`${path.basename(filename)} contains a sitemap entry without a location`)
      continue
    }
    if (sitemapLocations.has(location)) fail(`duplicate sitemap location: ${location}`)
    sitemapLocations.add(location)
    sitemapLastmods.set(new URL(location).pathname, entry.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1])
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
for (const [route, visibleDate] of docsModificationDates) {
  const sitemapDate = sitemapLastmods.get(route)
  if (!visibleDate && sitemapDate) {
    fail(`${route} sitemap lastmod must be omitted when source history is unavailable`)
  } else if (visibleDate && !sitemapDate) {
    fail(`${route} sitemap is missing the visible modification date`)
  } else if (visibleDate && sitemapDate) {
    const parsedSitemapDate = new Date(sitemapDate)
    if (
      Number.isNaN(parsedSitemapDate.getTime()) ||
      parsedSitemapDate.toISOString().slice(0, 10) !== visibleDate
    ) {
      fail(`${route} sitemap lastmod disagrees with the visible modification date`)
    }
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
