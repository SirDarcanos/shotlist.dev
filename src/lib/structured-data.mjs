import { readFileSync } from 'node:fs'

const packageMetadata = JSON.parse(readFileSync('node_modules/shotlist/package.json', 'utf8'))
const origin = 'https://shotlist.dev'
const websiteId = `${origin}/#website`
const softwareId = `${origin}/#software`
const maintainerId = `${origin}/#maintainer`
const maintainer = {
  '@type': 'Person',
  '@id': maintainerId,
  name: packageMetadata.author,
}

const quadrantBySegment = {
  tutorials: { name: 'Tutorials', href: '/docs/#tutorials' },
  'how-to': { name: 'How-to guides', href: '/docs/#how-to-guides' },
  reference: { name: 'Reference', href: '/docs/#reference' },
  explanation: { name: 'Explanation', href: '/docs/#explanation' },
}

export function homepageStructuredData(description) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: origin,
        name: 'shotlist',
        description,
        inLanguage: 'en',
        publisher: maintainer,
        mainEntity: { '@id': softwareId },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': softwareId,
        name: packageMetadata.name,
        url: origin,
        description,
        applicationCategory: 'Annotated screenshot automation',
        softwareRequirements: 'Node.js 20 or later',
        author: maintainer,
        license: { '@type': 'CreativeWork', name: 'MIT' },
        subjectOf: { '@id': websiteId },
      },
    ],
  }
}

export function docsBreadcrumbs(route, title) {
  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Documentation', href: '/docs/' },
  ]
  if (route === '/docs/') return [{ name: 'Home', href: '/' }, { name: 'Documentation' }]

  const quadrant = quadrantBySegment[route.split('/')[2]]
  if (!quadrant) throw new Error(`No documentation quadrant for ${route}`)
  return [...crumbs, quadrant, { name: title }]
}

export function docsStructuredData({ route, title, description, provenance, image, steps }) {
  const canonical = `${origin}${route}`
  const breadcrumbs = docsBreadcrumbs(route, title)
  const articleId = `${canonical}#article`
  const graph = [
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        ...(crumb.href ? { item: `${origin}${crumb.href}` } : {}),
      })),
    },
    {
      '@type': 'TechArticle',
      '@id': articleId,
      headline: title,
      description,
      url: canonical,
      mainEntityOfPage: canonical,
      inLanguage: 'en',
      author: { ...maintainer, name: provenance.author },
      version: provenance.version,
      isBasedOn: provenance.sourceUrl,
      image,
      isPartOf: { '@id': websiteId },
      about: { '@id': softwareId },
      ...(provenance.published ? { datePublished: provenance.published } : {}),
      ...(provenance.modified ? { dateModified: provenance.modified } : {}),
    },
  ]

  if (steps.length) {
    graph.push({
      '@type': 'HowTo',
      '@id': `${canonical}#how-to`,
      name: title,
      description,
      url: canonical,
      inLanguage: 'en',
      isPartOf: { '@id': articleId },
      about: { '@id': softwareId },
      step: steps.map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: step.label,
        url: `${canonical}#${step.id}`,
      })),
    })
  }

  return { '@context': 'https://schema.org', '@graph': graph }
}
