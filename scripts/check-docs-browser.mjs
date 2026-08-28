import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const origin = 'http://127.0.0.1:4322'
const server = spawn(
  process.execPath,
  ['node_modules/astro/bin/astro.mjs', 'preview', '--host', '127.0.0.1', '--port', '4322'],
  {
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)
let serverOutput = ''
server.stdout.on('data', (chunk) => (serverOutput += chunk))
server.stderr.on('data', (chunk) => (serverOutput += chunk))

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`${origin}/docs/`)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Astro preview did not start.\n${serverOutput}`)
}

let browser
try {
  await waitForServer()
  browser = await chromium.launch({ headless: true })

  const mobile = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  })
  const mobilePage = await mobile.newPage()
  await mobilePage.goto(`${origin}/docs/reference/configuration/#check`)

  const disclosure = mobilePage.locator('#docs-nav-disclosure')
  await mobilePage.waitForTimeout(1200)
  assert.equal(
    await disclosure.getAttribute('open'),
    null,
    'mobile documentation navigation starts closed',
  )
  assert.equal(
    await mobilePage.locator('#docs-nav a[aria-current="page"]').count(),
    1,
    'one documentation link identifies the current page',
  )
  const fragmentTarget = await mobilePage.locator('#check').boundingBox()
  assert.ok(fragmentTarget, 'a direct cross-page fragment arrival reaches its heading')
  assert.ok(fragmentTarget.y >= 112, 'sticky navigation does not cover the fragment target')
  assert.ok(fragmentTarget.y < 844, 'the fragment target arrives inside the mobile viewport')
  assert.equal(
    await mobilePage.locator('.page-toc a').count(),
    await mobilePage.locator('.docs-page article h2').count(),
    'section navigation links to every section',
  )

  await mobilePage.locator('#docs-nav summary').click()
  assert.equal(
    await disclosure.getAttribute('open'),
    '',
    'the native disclosure opens without JavaScript',
  )
  assert.ok(
    await mobilePage.locator('#docs-nav nav').isVisible(),
    'opening the disclosure reveals the navigation',
  )
  await mobile.close()

  const desktop = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1280, height: 900 },
  })
  const desktopPage = await desktop.newPage()
  await desktopPage.goto(`${origin}/docs/reference/configuration/`)
  assert.equal(
    await desktopPage.locator('#docs-nav summary').isVisible(),
    false,
    'desktop hides the mobile disclosure',
  )
  assert.ok(
    await desktopPage.locator('#docs-nav nav').isVisible(),
    'desktop shows the complete documentation navigation',
  )
  assert.ok(
    (await desktopPage.locator('#docs-nav nav > div').count()) > 1,
    'desktop shows every navigation section',
  )
  await desktop.close()

  const scripted = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const scriptedPage = await scripted.newPage()
  await scriptedPage.addInitScript(() => {
    window.__docsNavOpenChanges = []
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.target instanceof HTMLElement && record.target.id === 'docs-nav-disclosure') {
          window.__docsNavOpenChanges.push(record.target.hasAttribute('open'))
        }
      }
    }).observe(document, { attributes: true, attributeFilter: ['open'], subtree: true })
  })
  await scriptedPage.goto(`${origin}/docs/reference/configuration/`)
  await scriptedPage.waitForTimeout(100)
  assert.deepEqual(
    await scriptedPage.evaluate(() => window.__docsNavOpenChanges),
    [],
    'scripts do not change disclosure state after parsing',
  )
  assert.equal(
    await scriptedPage.locator('#docs-nav a[aria-current="page"]').count(),
    1,
    'scripted mobile navigation retains current-page state',
  )
  await scripted.close()

  console.log('Documentation navigation holds in mobile and desktop browsers.')
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
