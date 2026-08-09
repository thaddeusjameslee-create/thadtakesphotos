# thadtakesphotos.com

Static site — plain HTML, CSS, and a little JavaScript. No framework, no
bundler, no runtime dependencies. Three pages, dark theme.

```
data/
  gallery.json              the photographs and their alt text
  pricing.json              every price and every word of pricing copy
tools/
  build.mjs                 generates page content from the two data files
public/                     ← everything in here is public, nothing else is
  index.html                home: name, tagline, gallery, contact
  pricing/index.html        generated between markers from data/pricing.json
  about/index.html          hand-written
  css/styles.css            all styling; palette at the top in one :root block
  js/main.js                contact form + footer year, and nothing else
  photos/                   .jpg and .webp pairs
  _headers                  security + cache headers
wrangler.toml               deploy config
```

## Editing content

**Prices and pricing copy** live in `data/pricing.json`.
**Photographs and alt text** live in `data/gallery.json`.

After editing either:

```bash
node tools/build.mjs
```

That rewrites the marked regions of `public/pricing/index.html` and
`public/index.html`. Commit the regenerated HTML along with the data change.

Why a generator instead of loading JSON in the browser: the prices and the
photographs need to be in the HTML that Google and link previews read.
Rendering them client-side would leave the page empty to anything that doesn't
run JavaScript.

**The markers are load-bearing.** Don't hand-edit between
`<!-- pricing:start -->` / `<!-- pricing:end -->` or
`<!-- gallery:start -->` / `<!-- gallery:end -->` — the next build overwrites it.

## Adding photographs

1. Export at 1000×1500 (2:3), under 300KB.
2. Save both a `.jpg` and a `.webp` into `public/photos/`.
3. Add an entry to `data/gallery.json` with `base`, `width`, `height`, `alt`.
4. Run `node tools/build.mjs`.

Alt text should describe the subject and the setting. Name South Valley Park
only where it's actually the location. The grid is CSS columns, so it stays
composed whether there are six photographs or sixty; new ones flow into the
shortest column instead of leaving gaps.

## The palette

Every colour is declared once, in the `:root` block at the top of
`public/css/styles.css`. Nothing else hardcodes a colour.

The accent (`--accent: #dcb06d`) was sampled from the sunlit hogbacks in
`portrait-02` and `portrait-03` — the warmest quartile of roughly 262,000 lit
pixels, averaged. It's used only for links, focus rings, the active nav item,
and one hairline under the logotype. Never for fills.

All fourteen text/background pairs were checked against WCAG AA. If you change
the palette, re-check them — `--field-border` in particular is deliberately
lighter than `--line` because form fields are interactive and have to clear 3:1
against both the page and their own fill. At `--line`'s value they measured
1.31:1 and read as invisible boxes.

## Deploying

Push to `main`. Cloudflare builds and deploys automatically, usually within a
minute. Every deploy is kept — Worker → Deployments → Rollback.

**If you edit a data file, run the build before pushing.** Cloudflare's build
command is currently empty, so it deploys whatever HTML is committed. Setting
the build command to `node tools/build.mjs` would remove that footgun.

## Local preview

```bash
npx --yes serve --listen 4321 public
```

## Outstanding

- `{{TODO: bio}}` — two placeholder paragraphs in `public/about/index.html`
- `{{TODO: about portrait}}` — drop `about-portrait.jpg` + `.webp` (1000×1500) into `public/photos/`
- The homepage share image is an interim crop of `portrait-01`. Swap it for the violin portrait when that exists.
