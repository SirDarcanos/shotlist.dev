/**
 * Package `examples/starter/` as the download the tutorials begin with.
 *
 * The zip is generated rather than committed, so the folder in this repository is the one
 * source of truth for it — a reviewer reads the files, not a binary, and the two cannot
 * drift apart.
 *
 * `zip` is the system one. Node ships no archiver, and the alternative is a dependency
 * this site needs for nothing else.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = 'examples'
const FOLDER = 'shotlist-example'
const OUT = resolve('public/shotlist-example.zip')

rmSync(OUT, { force: true })
mkdirSync('public', { recursive: true })

try {
  execFileSync(
    'zip',
    // `-r` recurses; `-q` keeps the build log about the build. Excludes are things a
    // reader's own run would create, which have no business in a starter.
    ['-rq', OUT, FOLDER, '-x', `${FOLDER}/node_modules/*`, `${FOLDER}/public/images/*`],
    { cwd: SOURCE, stdio: ['ignore', 'inherit', 'inherit'] },
  )
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error('  ✗ `zip` is not on PATH, so the example download cannot be built')
    process.exit(1)
  }
  throw error
}

console.log('  example project packaged → public/shotlist-example.zip')
