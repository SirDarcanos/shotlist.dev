/**
 * Squeeze the built HTML without eating the spaces the prose is written with.
 *
 * Astro's own `compressHTML` removes insignificant whitespace, and counts the newline
 * between a word and the `<code>` after it as insignificant. It is not: prose is written
 * across lines, so that newline *is* the space, and sixty-nine of them went missing
 * before anybody noticed — as a typo in the copy, which is the last place anyone looks.
 *
 * So this collapses runs of whitespace to a single space rather than deleting them. It
 * gives up a little of the saving and keeps the sentences. In practice it gives up
 * nothing: the output is slightly smaller than Astro's, gzipped and not.
 *
 * `pre`, `textarea`, `script` and `style` are left exactly as they are — the first two
 * because their whitespace is the content, the last two because collapsing a line comment
 * into the line below it changes what the code means.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Regions whose whitespace is meaning rather than layout. */
const KEEP = /<(pre|textarea|script|style)\b[\s\S]*?<\/\1>/gi

/**
 * Collapse every run of whitespace outside those regions.
 *
 * Walked rather than split: `String.split` on a pattern with a capture group returns the
 * captures as well, and joining those back puts a stray `pre` after every `</pre>`.
 */
export function squeeze(html) {
  let out = ''
  let last = 0
  for (const match of html.matchAll(KEEP)) {
    out += html.slice(last, match.index).replace(/\s+/g, ' ') + match[0]
    last = match.index + match[0].length
  }
  return out + html.slice(last).replace(/\s+/g, ' ')
}

/** Squeeze every page under a directory, reporting what it came to. */
export function squeezeTree(root) {
  let before = 0
  let after = 0
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.html')) {
        const squeezed = squeeze(readFileSync(path, 'utf8'))
        before += statSync(path).size
        after += Buffer.byteLength(squeezed)
        writeFileSync(path, squeezed)
      }
    }
  }
  walk(root)
  return { before, after }
}

// Only when this file is what was run, so importing it in a test squeezes nothing.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { before, after } = squeezeTree(process.argv[2] ?? 'dist')
  const saved = Math.round(((before - after) / before) * 100)
  console.log(`  html ${before} → ${after} bytes (${saved}% smaller), spaces intact`)
}
