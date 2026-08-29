import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { launch } from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { chromium } from 'playwright'

const origin = 'http://127.0.0.1:4323'
const routes = ['/', '/docs/']
const runsPerRoute = 3
const resultsDirectory = path.resolve('artifacts/lighthouse')
const server = spawn(
  process.execPath,
  ['node_modules/astro/bin/astro.mjs', 'preview', '--host', '127.0.0.1', '--port', '4323'],
  { stdio: ['ignore', 'pipe', 'pipe'] },
)
let serverOutput = ''
server.stdout.on('data', (chunk) => (serverOutput += chunk))
server.stderr.on('data', (chunk) => (serverOutput += chunk))

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(origin)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Astro preview did not start.\n${serverOutput}`)
}

function median(values) {
  return [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)]
}

function metrics(lhr) {
  return {
    cls: lhr.audits['cumulative-layout-shift'].numericValue,
    lcp: lhr.audits['largest-contentful-paint'].numericValue,
    tbt: lhr.audits['total-blocking-time'].numericValue,
  }
}

let chrome
try {
  await waitForServer()
  await mkdir(resultsDirectory, { recursive: true })
  chrome = await launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
  })

  const summary = {
    generatedAt: new Date().toISOString(),
    environment: {
      origin,
      runsPerRoute,
      formFactor: 'mobile',
      throttlingMethod: 'simulate',
      chrome: chromium.executablePath(),
    },
    routes: {},
  }

  for (const route of routes) {
    const routeResults = []
    for (let run = 1; run <= runsPerRoute; run++) {
      const result = await lighthouse(`${origin}${route}`, {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance'],
        formFactor: 'mobile',
        throttlingMethod: 'simulate',
      })
      if (!result) throw new Error(`Lighthouse did not return a result for ${route}, run ${run}`)

      const runMetrics = metrics(result.lhr)
      routeResults.push(runMetrics)
      const name = route === '/' ? 'home' : 'docs'
      await writeFile(
        path.join(resultsDirectory, `${name}-${run}.json`),
        JSON.stringify(result.lhr, null, 2),
      )
    }

    summary.routes[route] = {
      runs: routeResults,
      median: {
        cls: median(routeResults.map(({ cls }) => cls)),
        lcp: median(routeResults.map(({ lcp }) => lcp)),
        tbt: median(routeResults.map(({ tbt }) => tbt)),
      },
    }
  }

  await writeFile(path.join(resultsDirectory, 'summary.json'), JSON.stringify(summary, null, 2))

  const failures = []
  for (const [route, { median: routeMedian }] of Object.entries(summary.routes)) {
    console.log(
      `${route} median — CLS ${routeMedian.cls.toFixed(3)}, LCP ${Math.round(routeMedian.lcp)} ms, TBT ${Math.round(routeMedian.tbt)} ms`,
    )
    if (routeMedian.cls >= 0.1) failures.push(`${route} CLS must be below 0.1`)
    if (routeMedian.lcp >= 2500) failures.push(`${route} LCP must be below 2500 ms`)
    if (routeMedian.tbt > 100) failures.push(`${route} TBT must remain at or below 100 ms`)
  }

  if (failures.length) throw new Error(`Performance gates failed:\n- ${failures.join('\n- ')}`)
  console.log(`Lighthouse reports saved to ${path.relative(process.cwd(), resultsDirectory)}/`)
} finally {
  await chrome?.kill()
  server.kill('SIGTERM')
}
