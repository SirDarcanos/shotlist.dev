# shotlist.dev

The site for [shotlist](https://github.com/SirDarcanos/shotlist). Astro 7 and Tailwind 4;
the docs are plain `.astro` pages under `src/pages/docs/`, one folder per Diátaxis
quadrant, not a content collection. `CLAUDE.md` is a symlink to this file — edit this one.

```bash
npm install
npm run dev     # zips the example project first, so /shotlist-example.zip resolves
npm run build   # checks examples, zips the example, builds, squeezes, checks spacing
```

Run `npm run format` before committing. Prettier decides formatting here as it does in
the package, and it reformats between edits — check that a search-and-replace landed
rather than that the command exited.

## Voice

The same voice as the package, and the docs pages are held to it hardest: there, the prose
is the product rather than a note about it. Match the file you are editing.

**State things.** Present indicative, as fact, not advice.

- Yes: `A recipe's keys are the vocabulary the docs are about.`
- No: `Keys should generally be highlighted where possible.`

**Every claim carries its reason, in the same breath.** A rule without its "because" gets
argued with, or followed in the wrong place.

- Yes: `Anything holding a code block needs min-w-0 — a flex track sizes to the widest line.`
- No: `Always add min-w-0. This is important.`

**Draw the contrast with "rather than".** The reason something matters is usually the thing
that happens instead: `collapses runs of whitespace rather than deleting them`.

**Be concrete.** Name the token, the class, the file, the ratio. `white on mark is 4.8:1`
teaches; "the contrast is a bit tight" does not.

**No filler.** Cut `simply`, `just`, `easy`, `obviously`, `of course`, `note that`,
`in order to`. Cut `powerful`, `seamless`, `beautiful` and every other adjective that
praises the site. No emoji, no exclamation marks.

**Length is set by content.** A one-line comment is complete if the code is. A long one
earns its length by carrying a real reason — the whitespace note in
`scripts/compress-html.mjs` is long because the failure it describes is genuinely
surprising. The sin is a sentence that adds nothing.

### Comments

- **One line, describing the thing, not the mechanics.** No `@param` or `@returns`; this
  codebase has none, and the types say it already.
- **A longer comment only where the code cannot speak for itself**: a non-obvious why, a
  gotcha, a workaround. Write the reason and the consequence, not a paraphrase of the
  next line.
- **Never narrate a change** — `// added for the new layout`, `// was flex before`. That
  belongs in the commit message, and the comment is stale the moment it lands.
- **A decision that outlives one component goes in this file**, not in a comment beside
  every use of it. Where a rationale is recorded in both, the comment says the local
  consequence and this file says why.

### The docs pages

- **The reader is editing YAML**, not TypeScript. Say what a key does, in plain language.
- **Every snippet is parsed by the build**, so an example is real or it does not ship —
  see below. Do not write a snippet you have not let `check-examples` see.
- **Nothing is documented that does not work yet**, unless it is marked as not built.
- **A page belongs to one quadrant, and the quadrant sets the register.** See below.

**The voice rules above hold everywhere except one place: reference does not carry its
reasons.** A reference page is a dictionary — key, default, effect, and nothing about why.
The "because" that would have ridden along in the same breath moves to an explanation page
and is linked. This is the one rule Diátaxis and the house voice disagree on, and Diátaxis
wins inside `/docs/reference/`. Everywhere else — how-to prose, explanation, comments,
the marketing copy — the reason still travels with the claim.

### Spelling and naming

- **American spelling in prose, comments and copy**: color, behavior, license, center,
  gray, recognized.
- **Identifiers follow the platform**, so code and CSS say `color`, `grid-template`.
- **`shotlist` is lowercase**, always, including at the start of a sentence.

## Decisions worth not re-litigating

**The docs are organized by [Diátaxis](https://diataxis.fr/), one quadrant per folder.**
They were one flat document in eleven parts, which had no tutorial at all and answered
"how do I shoot a page behind a sign-in?" across two pages that each held half of it. The
four folders under `src/pages/docs/` are the standard:

| Folder         | Answers                   | Register                                             |
| -------------- | ------------------------- | ---------------------------------------------------- |
| `tutorials/`   | Teach me, I am new        | A lesson. No choices, no options, guaranteed to work |
| `how-to/`      | I have this problem now   | A recipe. Goal in the title, steps, no teaching      |
| `reference/`   | What are the keys         | A dictionary. Austere, complete, no rationale        |
| `explanation/` | Why does it work this way | A discussion. The argument lives here                |

**Where a new page goes** is decided by the reader's situation, not the topic. Masking
appears in all four — a tutorial step, a how-to option, a `mask` table, and a paragraph in
_Why screenshots drift_ — and none of them is a duplicate of another. If a page you are
writing needs two registers, it is two pages.

**Still plain Astro pages, not Starlight.** Starlight would bring its own design system to
argue with the palette and the serif, and the two things that make these docs worth
building — a recipe printed beside the image that recipe generated, and reference tables
generated from `dist/*.schema.json` — are custom components either way. It is a
route-level integration, so `/docs` can move to Starlight later. Search, if it is wanted
before then, is Pagefind standalone.

**A docs URL that has shipped is kept working.** The package's README and its bundled
skill print docs URLs, and both are on npm where no edit here can reach them. The eleven
flat URLs the docs had before the quadrants redirect in `astro.config.mjs`. Moving or
renaming a page means adding one there — a released version linking into a 404 is the
worst kind of broken, because the reader cannot tell it was ever right.

**A tutorial is run, not read.** Both tutorials work against
`examples/shotlist-example/`, a dependency-free app shipped as a download so a newcomer
needs no application of their own. `scripts/build-example.mjs` zips the folder into
`public/shotlist-example.zip` on every `dev` and `build`, so the folder is the source of
truth and the zip is never committed. Anything you change in a tutorial has to still work
against that app — walking the steps is the only way to know, and it is worth the ten
minutes. Two defects that shipped past review were found that way.

**A number in a tutorial is measured, not estimated.** `check.threshold` defaults to
`0.002`, so a change smaller than 0.2% of an image reports `same` — which made a step that
edited one character silently teach the opposite of its lesson. Percentages, pixel counts
and command output in the docs come from a real run or a real measurement. Where a figure
cannot be pinned, say it will differ rather than inventing a plausible one.

**Three colors, in `src/styles/global.css`.** `mark` is the annotation red the package
draws with by default, `ink` is a warm near-black, `paper` a warm off-white. Everything
else — borders, muted text, the washed section background — is `color-mix()` derived from
those three rather than a fourth hue. The neutrals are warm deliberately: `#DC2626` sits
badly on a cool slate gray.

| Token   | Value     |
| ------- | --------- |
| `mark`  | `#DC2626` |
| `ink`   | `#1C1917` |
| `paper` | `#FAF8F5` |

**Fraunces for headings, Inter for body, JetBrains Mono for code.** The mono is not
decoration — the hero is a YAML recipe, and it is the thing readers actually study.

**Code blocks color YAML keys with `mark`.** The keys are the vocabulary the docs are
about. The theme is in `src/lib/code-theme.ts`; Shiki needs literal hex, so the grays
there are the same ink-into-paper mixes resolved by hand.

**A code card's border stays neutral, and only its arrow is red.** A red border was tried
and reverted. Red is the annotation — the thing being pointed at — and a frame around a
whole card points at nothing, so it spends the accent on chrome. Worse, it competes with
the red keys inside the card, which are the one thing there that has to stand out. The
arrow keeps the red because it genuinely points at the filename. The card has white fill
and a shadow against the paper background, so its border is only for definition and a
neutral rule gives it that.

## Section rhythm

All of these live in `src/styles/global.css`:

- **`.band-wash`** — a washed band that fades in and out of the page instead of butting
  against it. It replaced hard `border-y` rules, which cut the page into slabs.
- **`.paper-grid`** — faint graph paper, masked so it fades rather than stopping at an
  edge. The surface a shot is measured on. On the hero and the inverted section.
- **`.glow`** — a soft bloom of the annotation red, placed off-center. Position, size and
  strength are custom properties. Only the inverted section uses it; see below.
- **`.tone-red`** — the red ground and the text on it. The ground is `--red-deep`, which is
  `mark` taken down with `ink` — still derived from the three, not a fourth hue. It is
  darker than `mark` on purpose: white on `mark` is 4.8:1, the AA floor with nothing left
  to dim a muted token with, whereas on `--red-deep` the heading is 7.0:1 and body 5.3:1.
  It also sets `--grid-line`, so `.paper-grid` shows on it.
- **`.tone-light`** — resets the neutral tokens inside a card that brings its own white
  fill. Without it a `RecipeCard` dropped into `.tone-dark` or `.tone-red` inherits that
  section's near-paper `--muted` and its file path vanishes against the card.
- **`.tone-dark`** — the inverted section. Every neutral on this site is a custom
  property, so flipping the tone is a matter of redefining `--muted`, `--rule` and
  `--grid-line` in one class; anything inside that reads them follows without knowing it
  moved.

The dark tone sets `--muted` to 68% paper rather than the 62% that would mirror the light
tone. At 62% body copy lands at 6.3:1 — passing AA but thin going on a dark ground. 68%
clears 7:1.

Only one section is inverted, and it is the one that argues rather than explains. It gets
to interrupt; if a second one takes the treatment, neither does.

### How the red gets used in a background

**Blooms belong to the inverted section only.** They were tried across the light sections
too and taken out: on a light ground the red has to stay so faint to avoid reading as pink
that it earns nothing, and at any strength where it does show, it reads as a stain. A dark
ground takes far more red before it registers as color at all, which is why the same
device works there at 20–26% and nowhere else.

`--wash` is mixed from `ink`, not `mark`, for the same reason: a flat red tint across a
band reads as pink.

If a bloom is ever added near a section edge, note that each section clips its own
overflow, so one sitting on a boundary gets sliced and the cut shows.

**The red arrives on a straight edge, then ramps within itself.** _Getting started_ enters
on a hard boundary at `mark` and darkens to `--red-deep` by the footer, which is solid.
A ramp from the _page_ into red was built and removed — it read as abrupt however it was
tuned, and it forced padding wide enough to park the steep part where no copy sat, which
left a hole. Ramping red-into-red has neither problem: both ends are red, so it never
passes through a neutral, and it needs no extra space.

The ramp is weighted, not even. On a straight interpolation the first paragraph landed at
4.42:1 — under AA — because the top of the ramp is the brightest and therefore the tightest
point. Darkening faster over the first third puts the copy on ground that carries it,
rather than paying for it by whitening `--muted` until it is not muted at all.

The contrast numbers are why the ramp was awkward: ink on saturated red is 3.2:1, and
white on the lighter reds partway up a ramp is about 3.8:1. Neither passes, which is what
forced the steep part into the padding. A straight edge onto `--red-deep` has no such
constraint. Anything placed on that ground must be white, not `ink`.

**`compressHTML` is off, and `scripts/compress-html.mjs` does it instead.** Astro's default
is on, and its idea of insignificant whitespace includes the newline between a word and the
`<code>` after it. Prose is written across lines, so that newline _is_ the space — sixty-nine
of them were being eaten before anyone noticed, and it reads as a typo in the copy, which is
the last place you would look.

The replacement collapses runs of whitespace to a single space rather than removing them,
and leaves `pre`, `textarea`, `script` and `style` alone. It gives up nothing to do it —
measured against Astro's own output it came out slightly smaller, gzipped and not.
`npm run build` runs it and then `check-spacing`, which walks the output for a word run
into an inline tag and fails on one.

## The examples are checked by the build

Every YAML snippet under `/docs` is hand-written prose, so one can say something the
schema would refuse. One did: a `- comment:` on its own, which is a modifier rather than
a step.

`scripts/check-examples.mjs` runs first in `npm run build` and parses all of it with
shotlist's own `parseConfig` / `parseRecipe` / `parseQuery` / `Macro` — the docs snippets
and the recipe files this site shoots itself with. A snippet the schema would refuse
fails the build. shotlist is a devDependency for exactly this, and is what generated
reference tables would use too.

It walks `src/pages/docs/` recursively, since the pages moved into a folder per quadrant.
Three kinds of snippet are skipped, and the way you opt out is the way you declare what
the block is:

- a `RecipeCard` with `lang="bash"`, `lang="ts"` or `lang="css"` — not YAML at all
- a `const` named `raw…` — YAML that is not shotlist's, such as a CI workflow
- anything parsing to an array — a data file, which no schema describes

**A snippet has to be a whole document.** `numbered: [amount, status]` on its own reads as
a recipe with no marks and fails, correctly. Show the file, not the fragment you are
asking the reader to paste — which is better for them anyway.

**A const you define and never render is still parsed.** It has no `lang` to be skipped
by, so an unrendered block of shell output fails the build as malformed YAML. Render it or
delete it.

**The devDependency is the published shotlist, not your working copy.** Documenting a key
before it is on npm means the checker rejects the snippet — say the key in prose, and note
it here, rather than loosening the check.

## Abandoned, so nobody rebuilds it

- **A framing device on every section** — red corner brackets and a `clip: <name>` label,
  in four asymmetric variants. Too much apparatus for the payoff, and the brackets and the
  label were never the interesting part.
- **Red slanted blocks behind the section headings.** The headings are plain ink.
- **Blooms on the light sections.** They belong to the inverted section only, for the
  reason under the palette notes.
- **Fading the page into its colored footer**, tried twice — once to near-black, once to
  red. Paper to near-black passes through mid-gray in any color space and painted a dead
  field; the red version avoided that but still read as abrupt, and both needed padding
  wide enough to park the steep part where no copy sat. The footer is a straight edge.
- **A mock application annotated with a callout**, sitting inside a section. The ask was
  for the sections themselves to read as shots, not to contain a picture of an app.

## The marks

The red rounded rectangle is the box shotlist draws around a mark. That is the whole
identity — it is not a letterform and it does not need to be.

- `src/components/Logo.astro` — the box alone. Icon and favicon.
- `src/components/Wordmark.astro` — the box beside the word. This is the one in the nav.
- `public/favicon.svg` repeats the box with literal hex, because a favicon is loaded as an
  image and never sees the site's CSS variables. **Keep the two in step.**

Earlier attempts had the word's `s` cutting through the box's right edge. Recorded here
only so nobody spends the afternoon rediscovering it: setting the word in SVG and pinning
it with `textLength` — needed so the box could be authored around the glyphs — forces them
to a width they were not drawn for, and reads as stretched.

**The word is real text at its natural width.** Everything sizes from `font-size`, so the
lockup scales as one thing.

### The hover

Hovering the name spins the box and breathes it slowly in and out. This is scripted with
the Web Animations API rather than written as a `:hover` rule, because a CSS animation
cannot be let go of gently: removing it snaps the property back to its base value in a
single frame, and a `transition` does not soften that — transitions do not fire on a
change that comes from an animation ending.

So on leaving, the script commits where the box actually got to, cancels the loops, and
runs one last animation from there round to a whole turn, easing out. 360° and 0° look
identical, so it comes to rest exactly where it started.

Two details worth keeping:

- `commitStyles()` is how the live angle is read, not `getComputedStyle`. These animations
  run on the compositor, where computed style is not guaranteed to reflect them.
- The settle runs **forward** to the next whole turn rather than back to zero. Unwinding
  reverses the direction it was just travelling, which reads as a stumble.

`rotate` and `scale` are animated as their own properties rather than through one
`transform`, so the spin and the breath can run at their own tempos.

## Gotchas

- **Tailwind v4 dropped the `[--var]` shorthand.** Write `text-(--muted)`, not
  `text-[--muted]` — the latter compiles to `color:--muted` and is silently dropped.
- **Anything holding a code block needs `min-w-0`.** Grid and flex items default to
  `min-width: auto`, so the track sizes itself to the widest line and the page scrolls
  sideways instead of the block scrolling itself.
- **A scoped style cannot reach an element a child component renders.** `<Arrow class="x">`
  with `.x` in the parent's `<style>` silently matches nothing, and an SVG sized only by
  that rule collapses to 0×0. Use utility classes, or `:global()`.
- **A component's scoped style is unlayered, so it beats `@layer base` at any
  specificity.** `global.css` colors links in `@layer base`; `DocTable`'s own
  `td :global(code)` was repainting a linked key back to ink, and no amount of specificity
  added to the global rule could win. Fix it in the component, beside the rule it competes
  with.
- **`hidden` loses to anything that sets `display`.** Preflight gives every `svg`
  `display: block` and a `grid` utility does the same to whatever carries it, so an
  element carrying the attribute still renders. `global.css` restates
  `[hidden] { display: none !important }` for that reason.
- **`hidden` is an `HTMLElement` property, and an `<svg>` is not one.** `svg.hidden = true`
  sets a plain JavaScript property and never touches the attribute a stylesheet reads. Use
  `toggleAttribute('hidden', …)`. Reading it back is the same trap: check
  `getComputedStyle(el).display`, not `el.hidden`, or your verification has the same bug as
  the code.

## The site shoots itself

`shotlist.config.yaml` and `screenshots/recipes/` are real. `npm run shots` needs
Playwright and a server already answering on 4321; the images are committed, so an
ordinary build needs neither.

The recipes shown on the site are those files, imported with `?raw` — not strings in a
module that could drift from anything that runs. `src/pages/og.astro` is the Open Graph
card, a page whose only purpose is to be photographed into `public/og.png`, with a mark
drawn on the install command by the tool it advertises. It is `noindex` and filtered out
of the sitemap. **Re-run `npm run shots` after changing it.**

Two things to know if a recipe here stops working. `npm run dev` starts Astro detached
and exits, which `site.serve` reads as the server dying before it was ready — start the
server yourself first. And a recipe's `url` is used verbatim rather than resolved against
`site.url`, so a second page needs the whole origin.

## Not done yet

- No dark mode. The icon puts the `s` in `ink`, so the marks need a light background as
  they stand.
