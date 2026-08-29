import { parseFragment, serialize } from 'parse5'
import type { DefaultTreeAdapterMap } from 'parse5'

type Node = DefaultTreeAdapterMap['node']
type Element = DefaultTreeAdapterMap['element']

export interface DocsHeading {
  id: string
  label: string
}

interface PreparedDocsContent {
  content: string
  headings: DocsHeading[]
  pageTitle: string
  howToSteps: DocsHeading[]
}

function elementsBelow(node: Node): Element[] {
  if (!('childNodes' in node)) return []
  return node.childNodes.flatMap((child) => [
    ...('tagName' in child ? [child] : []),
    ...elementsBelow(child),
  ])
}

function textBelow(node: Node): string {
  if ('value' in node) return node.value
  if (!('childNodes' in node)) return ''
  return node.childNodes.map(textBelow).join('')
}

function slug(label: string): string {
  return label
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
}

/** Adds deterministic fragment targets and extracts the page's public document structure. */
export function prepareDocsContent(html: string): PreparedDocsContent {
  const fragment = parseFragment(html)
  const elements = elementsBelow(fragment)
  const pageTitle = elements
    .filter((element) => element.tagName === 'h1')
    .map((heading) => textBelow(heading).replace(/\s+/g, ' ').trim())[0]
  if (!pageTitle) throw new Error('Documentation pages need one visible h1')

  const headings: DocsHeading[] = []
  const usedIds = new Set<string>()

  for (const heading of elements.filter((element) => element.tagName === 'h2')) {
    const label = textBelow(heading).replace(/\s+/g, ' ').trim()
    const authoredId = heading.attrs.find((attribute) => attribute.name === 'id')
    const baseId = authoredId?.value || slug(label) || 'section'
    let id = baseId
    let suffix = 2
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`
    usedIds.add(id)

    if (authoredId) authoredId.value = id
    else heading.attrs.push({ name: 'id', value: id })
    headings.push({ id, label })
  }

  const numberedSteps = headings
    .map((heading) => ({ heading, number: Number(heading.label.match(/^Step (\d+):/)?.[1]) }))
    .filter(({ number }) => Number.isInteger(number))
  const howToSteps = numberedSteps.every(({ number }, index) => number === index + 1)
    ? numberedSteps.map(({ heading }) => heading)
    : []

  return { content: serialize(fragment), headings, pageTitle, howToSteps }
}
