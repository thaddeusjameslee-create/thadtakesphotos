# thadtakesphotos.com

Static site — plain HTML, CSS, and JavaScript. No build step, no dependencies,
no framework. Open `index.html` in a browser and it just works.

```
index.html          all the page copy lives here
css/styles.css      all the styling
js/main.js          gallery list + interactions
js/gallery3d.js     the scroll-driven 3D photo strip
js/vendor/          Three.js, vendored so the site depends on nobody
photos/             your images (see photos/README.md)
```

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

See [`photos/README.md`](photos/README.md). The site renders fine without them,
so you can deploy first and add photos as you shoot.

### 3. Connect the contact form

A static site can't send email on its own, so the form posts to
[Formspree](https://formspree.io) (free tier: 50 submissions/month).

1. Sign up, create a form, copy the endpoint it gives you.
2. In `index.html`, find `action="https://formspree.io/f/YOUR_FORM_ID"` and paste
   yours in.

Until you do that, the form shows a "not connected yet" message instead of
silently failing.

### 4. Replace the placeholder text

Search `index.html` for these and make them real:

- `hello@thadtakesphotos.com` — appears 3× (contact list, form fallback, footer area)
- `instagram.com/thadtakesphotos` — appears 2×
- `EDIT_YOUR_CITY_HERE` in the JSON-LD block near the top — your city/region, which
  is what gets you into "senior photographer near me" searches
- `Class of 2027` in the hero
- Prices and package contents in the Packages section
- The About section — that's my guess at your voice, rewrite it in yours. It
  asserts three things I invented and can't verify: how long you've been
  shooting, that senior portraits are your favourite work, and what camera you
  use. There's a comment in the markup flagging it.

**Already removed for you:** the three testimonials and the "200+ sessions"
figure were mine, not real, so they're off the live page. The testimonials
markup is still in `index.html` as a commented-out block with a two-quote
template — uncomment it and fill in genuine quotes when you have them. Ask
clients for a line or two right after you send their gallery; that's when
they're most enthusiastic, and most say yes.

### 5. Deploy

**Cloudflare Pages, drag-and-drop (easiest):**

1. <https://dash.cloudflare.com> → Workers & Pages → Create → Pages → Upload assets
2. Drag this whole folder in.
3. Custom domains → Set up a domain → `thadtakesphotos.com`. If the domain is
   registered at Cloudflare, DNS is automatic and HTTPS turns on by itself.

**Or from GitHub, so pushing updates the site:**

```bash
git init && git add -A && git commit -m "Initial site"
```

Push to a GitHub repo, then in Pages choose "Connect to Git". Build command:
leave empty. Build output directory: `/`.

---

## Working on it locally

```bash
npx --yes serve --listen 4321
```

Then open <http://localhost:4321>. Any editor will do — it's just three files.
