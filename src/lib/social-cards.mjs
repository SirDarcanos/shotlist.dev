export const socialCards = [
  {
    route: '/docs/',
    slug: 'docs',
    title: 'Documentation',
    section: 'Documentation',
  },
  {
    route: '/docs/tutorials/first-screenshot/',
    slug: 'first-screenshot',
    title: 'Your first screenshot',
    section: 'Tutorial',
  },
  {
    route: '/docs/tutorials/keeping-a-screenshot-current/',
    slug: 'keeping-a-screenshot-current',
    title: 'Keeping a screenshot current',
    section: 'Tutorial',
  },
  {
    route: '/docs/tutorials/document-a-wordpress-site/',
    slug: 'document-a-wordpress-site',
    title: "Document a client's WordPress site",
    section: 'Tutorial',
  },
  {
    route: '/docs/how-to/run-in-ci/',
    slug: 'run-in-ci',
    title: 'Run shotlist in CI',
    section: 'How-to guide',
  },
  {
    route: '/docs/how-to/annotate-an-image/',
    slug: 'annotate-an-image',
    title: 'Annotate an existing image',
    section: 'How-to guide',
  },
]

export function socialCardFor(pathname) {
  return socialCards.find((card) => card.route === pathname)
}
