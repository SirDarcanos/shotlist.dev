# Documentation provenance

Every page under `src/pages/docs/` publishes one provenance block through `Docs.astro`.
`src/lib/docs-provenance.mjs` is the source of that block and of documentation sitemap
`lastmod` values, so the visible date and crawler date cannot drift.

The applicable version and maintainer come from the installed `shotlist/package.json`.
Publication is the oldest commit date returned by `git log --follow` for the page source;
modification is the newest. A rename therefore keeps the page's history rather than
republishing it under a new path.

Dates are reliable only when the checkout has complete Git history. A shallow checkout,
a missing Git executable, or a source with no commits renders both dates as unavailable
and omits `lastmod`. Build time and filesystem timestamps are not fallbacks because a
deploy changes both without changing the page.

Source and correction links point to the page's `.astro` file on the repository's `main`
branch. A documentation route must map to that file before `Docs.astro` renders it.
