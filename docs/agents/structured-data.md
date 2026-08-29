# Structured data

`src/lib/structured-data.mjs` owns the site's JSON-LD. The homepage graph describes the
visible `WebSite` and `SoftwareApplication`; documentation graphs describe the visible
breadcrumb, article provenance, and any headings that form one numbered procedure.
Package name and maintainer come from the installed `shotlist/package.json`, while version,
dates, and source come from the same provenance object rendered below each article.

A documentation page receives `HowTo` only when its `Step 1:`, `Step 2:`, … headings form
one uninterrupted sequence. Tutorials and four ordered how-to guides meet that contract.
Option-based guides, reference, and explanation do not, so their graphs stop at
`BreadcrumbList` and `TechArticle` rather than describing alternatives as ordered steps.

`npm run build` parses every JSON-LD script and checks Schema.org type relationships,
canonical URLs, breadcrumb order, visible headings, page metadata, provenance, and social
images. It also rejects ratings, reviews, and offers because the visible site makes none of
those claims.

## Validation record

On 29 August 2026, the Schema.org Markup Validator tested the production HTML generated
locally through its code-snippet input:

| Build output                                      | Submitted entities                                    | Errors | Warnings |
| ------------------------------------------------- | ----------------------------------------------------- | -----: | -------: |
| `dist/index.html`                                 | `WebSite`, `SoftwareApplication`                      |      0 |        0 |
| `dist/docs/tutorials/first-screenshot/index.html` | `BreadcrumbList`, `TechArticle`, `HowTo`, `HowToStep` |      0 |        0 |

These pages cover every emitted Schema.org type and relationship. The final-site contract
checks the negative case separately: option-based guides remain `TechArticle` entities without
claiming an ordered procedure.

The same day's Google Rich Results Test code input for `dist/index.html` returned “Something
went wrong — Log in and try again,” so it recorded no eligibility result for the uncommitted
build. The type-specific outcome remains bounded by Google's published support:

- `BreadcrumbList` is a supported rich-result type. Valid markup makes a page eligible;
  Google does not guarantee that it will show a breadcrumb result.
- `SoftwareApplication` rich results require an `Offer` with a price. shotlist publishes no
  offer or price, so the homepage graph is descriptive and intentionally ineligible rather
  than inventing a zero-price offer.
- Google retired `HowTo` rich results and removed them from the Rich Results Test. The
  `HowTo` entities remain useful machine-readable procedures but create no Google rich-result
  eligibility.
- `TechArticle` is a Schema.org type, not a Google Rich Results Test feature. It describes
  provenance and subject matter without claiming a Google article enhancement.

Run the URL input after deployment and append its dated result here because it tests the
crawlable production response rather than the uncommitted build. A passing result establishes
eligibility for the supported type only.
