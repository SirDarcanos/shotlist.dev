import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'parse5'
import { canonicalRoutes, siteOrigin } from './route-contract.mjs'

const dist = path.resolve('dist')
const skippedTags = new Set(['button', 'nav', 'script', 'style', 'svg', 'template'])
const blockTags = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'dd',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul',
])

function markdownRouteFor(route) {
  return route === '/' ? '/index.md' : `${route.slice(0, -1)}.md`
}

function htmlFilenameFor(route) {
  return route === '/'
    ? path.join(dist, 'index.html')
    : path.join(dist, route.slice(1), 'index.html')
}

function attribute(node, name) {
  return node.attrs?.find((item) => item.name === name)?.value
}

function textContent(node) {
  if (node.nodeName === '#text') return node.value
  return (node.childNodes ?? []).map(textContent).join('')
}

function find(node, predicate) {
  if (predicate(node)) return node
  for (const child of node.childNodes ?? []) {
    const match = find(child, predicate)
    if (match) return match
  }
}

function descendants(node, tagName) {
  const matches = []
  if (node.tagName === tagName) matches.push(node)
  for (const child of node.childNodes ?? []) matches.push(...descendants(child, tagName))
  return matches
}

function normalizeInline(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function escapeText(value) {
  return value.replace(/\\/g, '\\\\').replace(/([\[\]])/g, '\\$1')
}

function inline(node) {
  if (node.nodeName === '#text') return escapeText(node.value)
  if (!node.tagName || skippedTags.has(node.tagName) || attribute(node, 'aria-hidden') === 'true') {
    return ''
  }

  const content = () => (node.childNodes ?? []).map(inline).join('')
  switch (node.tagName) {
    case 'a': {
      const label = normalizeInline(content())
      const href = attribute(node, 'href')
      return href && label ? `[${label}](${href})` : label
    }
    case 'br':
      return '  \n'
    case 'code': {
      const value = textContent(node).trim()
      const delimiter = value.includes('`') ? '``' : '`'
      return `${delimiter}${value}${delimiter}`
    }
    case 'em':
    case 'i':
      return `_${normalizeInline(content())}_`
    case 'strong':
    case 'b':
      return `**${normalizeInline(content())}**`
    case 'img': {
      const alt = attribute(node, 'alt')?.trim()
      const src = attribute(node, 'src')
      return alt && src ? `![${alt}](${src})` : ''
    }
    default:
      return content()
  }
}

function fencedCode(node) {
  const code = find(node, (child) => child.tagName === 'code') ?? node
  const language = attribute(code, 'class')?.match(/(?:^|\s)language-([\w-]+)/)?.[1] ?? ''
  const value = textContent(code).replace(/^\n/, '').replace(/\s+$/, '')
  const longestFence = Math.max(2, ...[...value.matchAll(/`+/g)].map((match) => match[0].length))
  const fence = '`'.repeat(longestFence + 1)
  return `${fence}${language}\n${value}\n${fence}`
}

function table(node) {
  const rows = descendants(node, 'tr').map((row) =>
    (row.childNodes ?? [])
      .filter((cell) => cell.tagName === 'th' || cell.tagName === 'td')
      .map((cell) => normalizeInline(inline(cell)).replace(/\|/g, '\\|')),
  )
  if (!rows.length || !rows[0].length) return ''
  const width = Math.max(...rows.map((row) => row.length))
  const line = (row) =>
    `| ${Array.from({ length: width }, (_, index) => row[index] ?? '').join(' | ')} |`
  return [line(rows[0]), line(Array(width).fill('---')), ...rows.slice(1).map(line)].join('\n')
}

function linkedBlocks(node) {
  const href = attribute(node, 'href')
  const parts = []
  let inlineNodes = []
  const flushInline = () => {
    const value = normalizeInline(inlineNodes.map(inline).join(''))
    if (value) parts.push(value)
    inlineNodes = []
  }

  for (const child of node.childNodes ?? []) {
    if (child.tagName && blockTags.has(child.tagName)) {
      flushInline()
      if (/^h[1-6]$/.test(child.tagName) && href) {
        parts.push(
          `${'#'.repeat(Number(child.tagName[1]))} [${normalizeInline(inline(child))}](${href})`,
        )
      } else {
        const value = blocks(child)
        if (value) parts.push(value)
      }
    } else {
      inlineNodes.push(child)
    }
  }
  flushInline()
  return parts.join('\n\n')
}

function list(node, ordered) {
  let number = Number(attribute(node, 'start') ?? 1)
  const items = (node.childNodes ?? []).filter((child) => child.tagName === 'li')
  return items
    .map((item) => {
      const marker = ordered ? `${number++}.` : '-'
      const value = blocks(item).trim().replace(/\n/g, '\n  ')
      return `${marker} ${value}`
    })
    .join('\n')
}

function blocks(node) {
  if (node.nodeName === '#text') return ''
  if (!node.tagName) return (node.childNodes ?? []).map(blocks).filter(Boolean).join('\n\n')
  if (skippedTags.has(node.tagName) || attribute(node, 'aria-hidden') === 'true') return ''

  switch (node.tagName) {
    case 'a':
      return linkedBlocks(node)
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return `${'#'.repeat(Number(node.tagName[1]))} ${normalizeInline(inline(node))}`
    case 'p':
    case 'figcaption':
      return normalizeInline(inline(node))
    case 'pre':
      return fencedCode(node)
    case 'ul':
      return list(node, false)
    case 'ol':
      return list(node, true)
    case 'table':
      return table(node)
    case 'blockquote': {
      const value = blocksChildren(node).replace(/\n/g, '\n> ')
      return `> ${value}`
    }
    case 'hr':
      return '---'
    case 'img':
      return inline(node)
    case 'dl':
      return (node.childNodes ?? [])
        .map((child) => {
          if (child.tagName === 'dt') return `**${normalizeInline(inline(child))}**`
          if (child.tagName === 'dd') return normalizeInline(inline(child))
          return ''
        })
        .filter(Boolean)
        .join('\n\n')
    default:
      return blocksChildren(node)
  }
}

function blocksChildren(node) {
  const parts = []
  let inlineNodes = []
  const flushInline = () => {
    const value = normalizeInline(inlineNodes.map(inline).join(''))
    if (value) parts.push(value)
    inlineNodes = []
  }

  for (const child of node.childNodes ?? []) {
    if (
      child.tagName &&
      (blockTags.has(child.tagName) ||
        (child.tagName === 'a' &&
          (child.childNodes ?? []).some((descendant) => blockTags.has(descendant.tagName))))
    ) {
      flushInline()
      const value = blocks(child)
      if (value) parts.push(value)
    } else {
      inlineNodes.push(child)
    }
  }
  flushInline()
  return parts.join('\n\n')
}

function clean(markdown) {
  return `${markdown
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`
}

const headerBlocks = []
for (const route of canonicalRoutes) {
  const html = await readFile(htmlFilenameFor(route), 'utf8')
  const document = parse(html)
  const root = route.startsWith('/docs/')
    ? find(document, (node) => node.tagName === 'article')
    : find(document, (node) => node.tagName === 'main')
  if (!root) throw new Error(`${route} has no content root`)

  const markdownRoute = markdownRouteFor(route)
  const filename = path.join(dist, markdownRoute.slice(1))
  await mkdir(path.dirname(filename), { recursive: true })
  await writeFile(filename, clean(blocksChildren(root)))

  headerBlocks.push(
    `${markdownRoute}\n` +
      '  Content-Type: text/markdown; charset=utf-8\n' +
      '  X-Robots-Tag: noindex\n' +
      `  Link: <${siteOrigin}${route}>; rel="canonical"`,
  )
}

const headersFilename = path.join(dist, '_headers')
const marker = '# Generated Markdown alternate response metadata.'
const headers = (await readFile(headersFilename, 'utf8')).split(marker)[0].trimEnd()
await writeFile(headersFilename, `${headers}\n\n${marker}\n${headerBlocks.join('\n\n')}\n`)

console.log(`Generated ${canonicalRoutes.length} Markdown alternates.`)
