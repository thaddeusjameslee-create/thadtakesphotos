# thadtakesphotos.com

Static site — plain HTML, CSS, and JavaScript. No build step, no dependencies,
no framework. Open `index.html` in a browser and it just works.

```
public/                     ← everything in here is public, nothing else is
  index.html                all the page copy lives here
  css/styles.css            all the styling
  js/main.js                photo list + interactions + 3D loading
  js/camera3d.js            the scroll-driven exploded camera
  js/gallery3d.js           the scroll-driven 3D photo strip
  js/vendor/                Three.js, vendored so the site depends on nobody
  photos/                   your images (see PHOTOS.md)
  _headers                  cache + security headers

wrangler.toml               deploy config — read the warning in it
PHOTOS.md                   naming + export guide for your photos
README.md                   this file
```

The `public/` split isn't decoration. Only that folder is uploaded, so this
README, the deploy config, and your git history physically cannot end up on
the web — no filter rule to get wrong.

## The exploded camera

A stylised SLR built entirely from Three.js primitives in `js/camera3d.js` —
twenty separate parts, no downloaded model. Scrolling its section takes it from
assembled, out to an exploded view at the halfway point, and back together by
the end. The out-and-back comes from a single sine over the scroll progress.

Building it in code rather than importing a model was the deciding factor: an
exploded view needs parts that were never merged into one mesh, and most
downloadable camera models are a single blob.

Three portraits orbit it on an inclined ring. They read `photos/portrait-01.jpg`
through `-03.jpg`; drop real files at those paths and they replace the
placeholders with no code change. The panels are 2:3, the native portrait ratio
out of a DSLR, so your framing isn't cropped to fit them.

Nothing is positioned by hand-tuned numbers. On every resize the code measures
the model's fully-exploded bounding radius from the geometry, sizes the camera
to fit the frame, then places the ring *outside* that radius plus `clearance`.
Deriving the ring from the camera and not the other way round is what keeps the
camera legible on a phone — the reverse lets a narrow frame squeeze the ring,
which squeezes the camera down to a speck. The cost is that panels swing past
the frame edges on narrow screens, which is intentional.

Tuning lives in the `CFG` block at the top — `spread` for how far parts fly,
`spin` for how much it turns, `ease` for how lazily it follows the scroll,
`clearance` for the gap between the parts and the portraits, `maxScale` for the
overall size ceiling. The part list below that is a plain array; each entry has
a resting position and the direction it travels when things come apart.

## The 3D gallery

Photos ride a curved, infinitely-looping strip. Scrolling the page walks it
sideways, you can grab and fling it, and clicking a photo opens the lightbox.
The warping and colour-fringing as it moves are a custom shader in
`js/gallery3d.js`.

It is strictly an **enhancement**. The plain masonry grid is the real content —
it's what search engines read and what keyboard users get. The strip only
appears when the browser can actually drive it, and the site sits out
automatically when:

- the visitor has "reduce motion" turned on in their OS
- WebGL is unavailable
- the device reports 2 or fewer CPU cores, or under 4 GB of RAM
- Three.js fails to load for any reason

In all those cases the grid stays on screen and nothing looks broken. There's
also a **Grid view** toggle next to the filters so anyone can switch back by hand.

Three.js is ~180 KB over the wire and isn't fetched until the visitor scrolls
within 600px of the gallery, so it costs nothing on page load.

**Tuning it:** the `CFG` block at the top of `js/gallery3d.js` controls the look —
`curve` (how far the strip bows), `twist` (how much photos turn), `ease` (inertia;
lower is floatier), `gapFactor` (spacing), and `aspect` (photo shape). Change a
number, reload, look. The scroll distance is `.gl { height: 320vh }` in the CSS —
raise it to slow the travel down, lower it to speed it up.

**Turning it off entirely:** delete the `if (canRun3D())` block at the bottom of
`js/main.js`. Everything else keeps working.

---

## Your to-do list

### 1. Buy the domain

Cloudflare Registrar sells `.com` at cost (~$10/yr, no markup, no upsells, free
WHOIS privacy) and it puts the domain and the hosting in the same dashboard:
<https://dash.cloudflare.com> → Domain Registration → Register Domain.

Namecheap or Porkbun are fine too — you'll just point the nameservers at
Cloudflare afterward.

### 2. Add your photos

See [`PHOTOS.md`](PHOTOS.md). The site renders fine without them,
so you can deploy first and add photos as you shoot.

### 3. Connect the contact form

A static site can't send email on its own, so the form posts to
[Formspree](https://formspree.io) (free tier: 50 submissions/month).

1. Sign up, create a form, copy the endpoint it gives you.
2. In `index.html`, find `action="https://formspree.io/f/YOUR_FORM_ID"` and paste
   yours in.

Until you do that, the form shows a "not connected yet" message instead of
silently failing.

### 4. Add real content

The page has been stripped back to only what's true: the name, the fact that
it's senior portrait photography, an empty gallery, and a contact form. Every
invented placeholder is gone.

Removed, and worth adding back once each one is real:

| Section | What it needs from you |
|---|---|
| Packages | Your actual prices and what's included |
| About | Your bio, in your words |
| FAQ | Your real policies — booking lead time, rain, turnaround, deposit |
| Testimonials | Genuine client quotes. Ask right after you deliver a gallery |
| Hero tagline | A line that sounds like you |
| Instagram / email | Real handle and inbox |
| `areaServed` in the JSON-LD | Your city — this is what drives "senior photographer near me" |

**Nothing is lost.** All of it is in git — `git show f92cd47:public/index.html`
prints the previous full version, and you can copy any section straight out of
it. Restore by pasting it back and editing the text to be true.

### 5. Deploy

The site is already live at <https://thadtakesphotos.com>, served by a Cloudflare
Worker named `black-butterfly-1273`. Three ways to update it, in order of how
little thinking they require.

**a) One command (set up, works now):**

```bash
npx wrangler deploy
```

Run it from this folder. First time it opens a browser to log in to Cloudflare;
after that it's instant. It reads `wrangler.toml`, uploads `public/`, and
replaces the live site. Roughly ten seconds.

**b) Push to deploy (the automatic one):**

Once this repo is on GitHub, connect it in the dashboard:

> Your Worker → **Settings** → **Build** → **Connect** → pick the repo

Set **deploy command** to `npx wrangler deploy` and leave the build command
empty — there's nothing to build. From then on every `git push` to `main`
redeploys by itself, and each push shows up in the Deployments tab.

**c) Drag-and-drop:** still works — **New deployment** in the dashboard — but
drag the **`public/` folder**, not the project root. Dragging the root would
publish `wrangler.toml` and this README.

### Rolling back

Every deploy is kept. Worker → **Deployments** → find a known-good one →
**Rollback**. Takes seconds and doesn't need your local files to be in any
particular state, which is the real reason to deploy early and often.

---

## Working on it locally

```bash
npx --yes serve --listen 4321 public
```

Then open <http://localhost:4321>. Note the `public` on the end — serving the
project root instead would give you a file listing rather than the site.
