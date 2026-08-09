# shotlist example project

A small application to practise shotlist against, and a documentation page for the
screenshots to be installed into. It has no dependencies of its own.

Start it:

```bash
npm run dev
```

- <http://localhost:3000> — the Orders screen, the thing you photograph
- <http://localhost:3000/docs.html> — the documentation page the screenshot is installed into

If something else already has port 3000, run it elsewhere with `PORT=3001 npm run dev`, and
set `site.url` in `shotlist.config.yaml` to the port you chose.

Then follow the tutorial at <https://shotlist.dev/docs/tutorials/first-screenshot>, which
begins by installing shotlist here.

## What is in it

| Path                | What it is                                                    |
| ------------------- | ------------------------------------------------------------- |
| `server.mjs`        | A static file server for `public/`, on port 3000              |
| `public/index.html` | The Orders screen                                             |
| `public/docs.html`  | The documentation page, showing `public/images/order-row.png` |
| `public/style.css`  | Styles for both                                               |

Edit `public/index.html` and `public/style.css` freely. Restyling the Open badge is how the
second tutorial shows `shotlist --check` catching a screenshot that has gone stale.

The "Cash collected this week" chart is redrawn with different figures on every load. It is
there so the second tutorial has a region that genuinely cannot be captured twice, which is
what `mask` is for.
