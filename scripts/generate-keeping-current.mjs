import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const config = 'shotlist.demo.config.yaml'
const stylesheet = 'examples/shotlist-example/public/style.css'
const baseline = 'shotlist.baseline.json'
const installed = 'public/images/order-row.png'
const output = 'screenshots/out/order-row.png'
const diff = 'screenshots/out/diff/order-row.png'
const assets = 'public/images/keeping-current'
const shotlist = fileURLToPath(new URL('./cli.js', import.meta.resolve('shotlist')))
const originalRule = `.status-open {
  background: #e0e7ff;
  color: #3730a3;
}`
const changedRule = `.status-open {
  background: #fde68a;
  color: #92400e;
}`

function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [shotlist, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  process.stdout.write(result.stdout)
  process.stderr.write(result.stderr)
  if (result.status !== expectedStatus) {
    throw new Error(
      `shotlist exited with status ${result.status ?? 'unknown'}; expected ${expectedStatus}`,
    )
  }
  return result
}

const originalStylesheet = readFileSync(stylesheet, 'utf8')
const originalBaseline = readFileSync(baseline)
const originalInstalled = readFileSync(installed)
if (!originalStylesheet.includes(originalRule)) {
  throw new Error(`${stylesheet} no longer contains the documented Open badge rule`)
}

mkdirSync(assets, { recursive: true })
try {
  run(['order-row', '--config', config, '--install'])
  copyFileSync(output, `${assets}/committed.png`)

  writeFileSync(stylesheet, originalStylesheet.replace(originalRule, changedRule))
  rmSync(output, { force: true })
  rmSync(diff, { force: true })
  const result = run(['order-row', '--config', config, '--check', '--diff', '--json'], 1)
  let report
  try {
    report = JSON.parse(result.stdout)
  } catch {
    throw new Error('shotlist did not produce a JSON check report')
  }
  if (
    report.changed !== 1 ||
    report.total !== 1 ||
    report.results?.length !== 1 ||
    report.results[0].name !== 'order-row' ||
    report.results[0].status !== 'changed' ||
    !report.results[0].diff
  ) {
    throw new Error('shotlist did not report the expected order-row change and diff')
  }
  copyFileSync(output, `${assets}/changed.png`)
  copyFileSync(diff, `${assets}/diff.png`)
} finally {
  writeFileSync(stylesheet, originalStylesheet)
  writeFileSync(baseline, originalBaseline)
  writeFileSync(installed, originalInstalled)
}

console.log(`  Ledger drift sequence generated → ${assets}`)
