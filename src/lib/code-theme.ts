/**
 * The syntax theme for every code block on the site.
 *
 * Shiki's `github-light`, with one change: a YAML key is the annotation red rather than
 * green. A recipe's keys are the vocabulary the docs are about, and the red is the colour
 * this site points with — the same red the package draws a mark in.
 *
 * `entity.name.tag` alone, not every rule painted green. The other three are regular
 * expression escapes, block quotes, and the added side of a diff, where green is a
 * convention worth more than consistency with a palette.
 */
import githubLight from 'shiki/themes/github-light.mjs'

interface Rule {
  scope?: string | string[]
  settings: { foreground?: string; fontStyle?: string }
}

interface Theme {
  name: string
  type: string
  colors: Record<string, string>
  tokenColors: Rule[]
}

const MARK = '#DC2626'
const source = ((githubLight as { default?: Theme }).default ?? githubLight) as unknown as Theme

export const codeTheme = {
  ...source,
  name: 'shotlist',
  tokenColors: source.tokenColors.map((rule) =>
    rule.scope === 'entity.name.tag'
      ? { ...rule, settings: { ...rule.settings, foreground: MARK } }
      : rule,
  ),
}
