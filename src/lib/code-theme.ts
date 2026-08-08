/**
 * The syntax theme for every code block on the site.
 *
 * A recipe's keys are the vocabulary the docs are about, so they carry the annotation
 * red; values are ink. Shiki needs literal hex, so the muted greys here are the same
 * ink-into-paper mixes `global.css` makes with `color-mix()`, resolved by hand.
 */
export const codeTheme = {
  name: 'shotlist',
  type: 'light' as const,
  colors: {
    'editor.background': '#00000000',
    'editor.foreground': '#1C1917',
  },
  settings: [
    { settings: { foreground: '#1C1917' } },

    // Keys — `name:`, `setup:`, `clip:` — are the language being documented.
    {
      scope: ['entity.name.tag', 'support.type.property-name', 'variable.other.key'],
      settings: { foreground: '#DC2626', fontStyle: 'bold' },
    },

    // Prose the author wrote: values, strings, plain scalars.
    {
      scope: ['string', 'string.quoted', 'string.unquoted', 'meta.embedded'],
      settings: { foreground: '#1C1917' },
    },

    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#969491' } },

    {
      scope: ['punctuation', 'meta.brace', 'keyword.operator', 'punctuation.definition.block'],
      settings: { foreground: '#969491' },
    },

    {
      scope: ['constant.numeric', 'constant.language', 'constant.other'],
      settings: { foreground: '#57534E' },
    },

    // Shell blocks: the command reads as ink, its flags as the muted grey.
    { scope: ['source.shell', 'support.function.builtin'], settings: { foreground: '#1C1917' } },
    {
      scope: ['constant.other.option', 'entity.name.function'],
      settings: { foreground: '#969491' },
    },
  ],
}
