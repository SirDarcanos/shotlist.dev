import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const packageMetadata = JSON.parse(readFileSync('node_modules/shotlist/package.json', 'utf8'))
const sourceRepository = 'https://github.com/SirDarcanos/shotlist.dev'

function docsSourcePath(route) {
  if (route === '/docs/') return 'src/pages/docs/index.astro'
  if (!route.startsWith('/docs/')) return undefined
  return `src/pages${route.slice(0, -1)}.astro`
}

function fullHistoryAvailable() {
  try {
    return (
      execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() === 'false'
    )
  } catch {
    return false
  }
}

const hasFullHistory = fullHistoryAvailable()
const historyBySource = new Map()

function sourceHistory(sourcePath) {
  if (!hasFullHistory) return {}
  if (historyBySource.has(sourcePath)) return historyBySource.get(sourcePath)

  try {
    const dates = execFileSync('git', ['log', '--follow', '--format=%cs', '--', sourcePath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .split('\n')
      .filter(Boolean)
    const history = dates.length ? { published: dates.at(-1), modified: dates[0] } : {}
    historyBySource.set(sourcePath, history)
    return history
  } catch {
    return {}
  }
}

export function docsProvenance(route) {
  const sourcePath = docsSourcePath(route)
  if (!sourcePath) return undefined

  return {
    version: packageMetadata.version,
    maintainer: packageMetadata.author,
    sourcePath,
    sourceUrl: `${sourceRepository}/blob/main/${sourcePath}`,
    editUrl: `${sourceRepository}/edit/main/${sourcePath}`,
    ...sourceHistory(sourcePath),
  }
}
