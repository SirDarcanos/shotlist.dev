# shotlist.dev

The website for **shotlist**, a tool for taking annotated UI screenshots. It opens a
running site, drives it to the state you describe, clips a region, draws the callouts on
it, and writes the image where the project asks. Each screenshot is a YAML file.

- **Package:** [github.com/SirDarcanos/shotlist](https://github.com/SirDarcanos/shotlist)
- **Site:** [shotlist.dev](https://shotlist.dev)
- **Docs:** [shotlist.dev/docs](https://shotlist.dev/docs)

This repository is the site only. Astro 7 and Tailwind 4, no content collections — the
docs are plain `.astro` pages under `src/pages/docs/`.

```bash
npm install
npm run dev
npm run build
```

How the site is built and why it looks the way it does is in [AGENTS.md](./AGENTS.md).
