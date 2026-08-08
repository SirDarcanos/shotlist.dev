/**
 * Every place a space went missing around an inline tag.
 *
 * Prose is written across lines, so the space between a word and the `<code>` after it is
 * a newline — and a build that treats that as insignificant whitespace runs the two
 * together. It reads as a typo in the copy, which is where anyone would look first.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] ?? 'dist'
const INLINE = /[a-zA-Z,;)]<(?:code|span|a|em|strong)\b|<\/(?:code|span|a|em|strong)>[a-zA-Z(]/g

let hits = 0
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (entry.name.endsWith('.html')) {
      const html = readFileSync(path, 'utf8')
      for (const para of html.matchAll(/<(p|li|h[1-6])[^>]*>([\s\S]*?)<\/\1>/g)) {
        for (const m of para[2].matchAll(INLINE)) {
          const at = m.index
          console.log(
            `  ${path}\n    …${para[2].slice(Math.max(0, at - 45), at + 45).replace(/\s+/g, ' ')}…`,
          )
          hits++
        }
      }
    }
  }
}
walk(root)
console.log(hits ? `\n${hits} missing space(s)` : '\nno missing spaces')
process.exit(hits ? 1 : 0)
