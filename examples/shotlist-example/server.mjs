/**
 * A static file server for `public/`, on port 3000.
 *
 * Written against `node:http` and nothing else so the example installs and runs with no
 * dependencies of its own — the point of the exercise is shotlist, and a reader should
 * not have to wait for an unrelated tree to download before they can start.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'public')
const PORT = Number(process.env.PORT ?? 3000)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  // `normalize` first, so a request for `../../etc/passwd` cannot climb out of `public/`.
  const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''))
  const target = path.endsWith('/') ? join(file, 'index.html') : file

  try {
    const body = await readFile(target)
    response.writeHead(200, {
      'content-type': TYPES[extname(target)] ?? 'application/octet-stream',
      // A screenshot must be of what is on disk now, not of what was cached a run ago.
      'cache-control': 'no-store',
    })
    response.end(body)
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
})
  // A port already taken is the likeliest thing to go wrong here, and it happens on the
  // first command of the tutorial. Say what to do about it instead of printing a stack.
  .on('error', (error) => {
    if (error.code !== 'EADDRINUSE') throw error
    console.error(`Port ${PORT} is already in use by something else.`)
    console.error('Stop that, or run this on another port:')
    console.error(`  PORT=3001 npm run dev`)
    console.error('If you change the port, change `site.url` in shotlist.config.yaml to match.')
    process.exit(1)
  })
  .listen(PORT, () => {
    console.log(`Local: http://localhost:${PORT}`)
  })
