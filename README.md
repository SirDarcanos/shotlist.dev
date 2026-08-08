# shotlist.dev

The site for [shotlist](https://github.com/SirDarcanos/shotlist). Astro, Tailwind,
`astro-seo` and `@astrojs/sitemap`.

```bash
npm install
npm run dev
```

## Decisions worth not re-litigating

**Docs are plain pages, not Starlight.** The reference is one document in eleven parts,
and most of it already exists in the package's README. Starlight would bring its own
design system to argue with the palette and the serif, and the two things that make these
docs worth building — a recipe printed beside the image that recipe generated, and
reference tables generated from `dist/*.schema.json` — are custom components either way.
It is a route-level integration, so `/docs` can move to Starlight later if this grows into
a manual. Search, if it is wanted before then, is Pagefind standalone.

**Three colours, in `src/styles/global.css`.** `mark` is the annotation red the package
draws with by default, `ink` is a warm near-black, `paper` a warm off-white. Everything
else — borders, muted text, the washed section background — is `color-mix()` derived from
those three rather than a fourth hue. The neutrals are warm deliberately: `#DC2626` sits
badly on a cool slate grey.

| Token   | Value     |
| ------- | --------- |
| `mark`  | `#DC2626` |
| `ink`   | `#1C1917` |
| `paper` | `#FAF8F5` |

**Fraunces for headings, Inter for body, JetBrains Mono for code.** The mono is not
decoration — the hero is a YAML recipe, and it is the thing readers actually study.

**Code blocks colour YAML keys with `mark`.** The keys are the vocabulary the docs are
about. The theme is in `src/lib/code-theme.ts`; Shiki needs literal hex, so the greys
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
- **`.glow`** — a soft bloom of the annotation red, placed off-centre. Position, size and
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
ground takes far more red before it registers as colour at all, which is why the same
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

## The examples are not checked, and should be

Every YAML snippet under `/docs` is hand-written prose. Nothing parses them, so one can
say something the schema would refuse — and one did: a `- comment:` on its own, which is
a modifier rather than a step. They were checked once, by hand, against the package's
`parseConfig` / `parseRecipe` / `parseQuery`, and all of them parse today.

Making that permanent needs shotlist as a devDependency here, which is worth doing once
it is published with the schemas the docs describe. The same dependency is what the
generated reference tables would need.

## Abandoned, so nobody rebuilds it

- **A framing device on every section** — red corner brackets and a `clip: <name>` label,
  in four asymmetric variants. Too much apparatus for the payoff, and the brackets and the
  label were never the interesting part.
- **Red slanted blocks behind the section headings.** The headings are plain ink.
- **Blooms on the light sections.** They belong to the inverted section only, for the
  reason under the palette notes.
- **Fading the page into its coloured footer**, tried twice — once to near-black, once to
  red. Paper to near-black passes through mid-grey in any colour space and painted a dead
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

## Not done yet

- The nine reference pages. `src/layouts/Docs.astro` lists them with `ready: false`, which
  renders them in the sidebar without a link rather than pointing at a 404.
- Recipes in `src/lib/recipes.ts` are written against the real schema and would parse, but
  the shots they describe are not taken. When the site shoots itself, those strings should
  be read from the recipe files instead of living in a TypeScript module.
- No Open Graph image, and no dark mode. The icon puts the `s` in `ink`, so the marks need
  a light background as they stand.
- `src/pages/logo-proof.astro` is a scratch page for judging the marks at several sizes.
  Delete it before the site goes anywhere.
