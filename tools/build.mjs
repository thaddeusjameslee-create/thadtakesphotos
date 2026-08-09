/* ============================================================
   Generates the pricing page's content from data/pricing.json.

   Why a generator rather than fetching JSON in the browser: the
   prices need to be in the HTML that crawlers and link previews
   read. Rendering them client-side would leave the page empty to
   anything that doesn't run JavaScript.

   Run after editing data/pricing.json:

       node tools/build.mjs

   Zero dependencies — plain Node, nothing to install.
   ============================================================ */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(root, "data", "pricing.json");
const PAGE = join(root, "public", "pricing", "index.html");
const GALLERY_DATA = join(root, "data", "gallery.json");
const HOME = join(root, "public", "index.html");

const START = "<!-- pricing:start -->";
const END = "<!-- pricing:end -->";

/* Escape anything coming out of the data file — it's authored by hand and
   ends up inside markup. */
const esc = s => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const data = JSON.parse(readFileSync(DATA, "utf8"));

const tier = t => `
        <article class="tier${t.best ? " tier--best" : ""}">
          ${t.flag ? `<p class="tier__flag">${esc(t.flag)}</p>` : ""}
          <h3>${esc(t.name)}</h3>
          <p class="tier__price">${esc(t.price)}</p>
          <p class="tier__desc">${esc(t.summary)}</p>
          <ul>
${t.includes.map(i => `            <li>${esc(i)}</li>`).join("\n")}
          </ul>
          <a class="btn${t.best ? "" : " btn--ghost"}" href="/?option=${esc(t.option)}#contact">${esc(t.cta)}</a>
        </article>`;

const addon = a => `
        <li class="addon">
          <span class="addon__name">${esc(a.name)}</span>
          <span class="addon__price">${esc(a.price)}</span>
          <p class="addon__desc">${esc(a.desc)}</p>
        </li>`;

/* The h2 below is load-bearing, not decoration: the tier names are h3, and
   without it the page jumps h1 -> h3 and the heading outline is broken. */
const block = `${START}
      <p class="notice"><strong>Everything is digital.</strong> ${esc(data.delivery)}</p>

      <h2 id="sessions">Two ways to book</h2>

      <div class="tiers">${data.tiers.map(tier).join("")}
      </div>

      <h2 id="add-ons">Add-ons</h2>
      <p class="lede">For building your own combination.</p>
      <ul class="addons">${data.addons.map(addon).join("")}
      </ul>

      <h2 id="booking">Booking</h2>
      <p class="lede">${esc(data.booking)}</p>
      ${END}`;

/* Replace everything between a pair of markers in a file. */
function splice(file, startTag, endTag, replacement) {
  const html = readFileSync(file, "utf8");
  const a = html.indexOf(startTag);
  const b = html.indexOf(endTag);
  if (a === -1 || b === -1) {
    console.error(`build: markers ${startTag} / ${endTag} not found in ${file}`);
    process.exit(1);
  }
  writeFileSync(file, html.slice(0, a) + replacement + html.slice(b + endTag.length));
}

splice(PAGE, START, END, block);
console.log(
  `build: pricing  -> ${data.tiers.length} tiers, ${data.addons.length} add-ons`
);

/* ── Gallery ────────────────────────────────────────────────
   Server-rendered so crawlers and no-JS visitors see the photographs,
   and so width/height are present to reserve space before the image
   loads. The first two are eager; everything after is lazy. */
const GAL_START = "<!-- gallery:start -->";
const GAL_END = "<!-- gallery:end -->";

const gallery = JSON.parse(readFileSync(GALLERY_DATA, "utf8"));

const shot = (p, i) => `
        <figure class="shot">
          <picture>
            <source srcset="/photos/${esc(p.base)}.webp" type="image/webp">
            <img src="/photos/${esc(p.base)}.jpg"
                 alt="${esc(p.alt)}"
                 width="${esc(p.width)}" height="${esc(p.height)}"
                 loading="${i < 2 ? "eager" : "lazy"}"
                 decoding="async"${i < 2 ? ' fetchpriority="high"' : ""}>
          </picture>
        </figure>`;

const galleryBlock = `${GAL_START}${gallery.photos.map(shot).join("")}
      ${GAL_END}`;

splice(HOME, GAL_START, GAL_END, galleryBlock);
console.log(`build: gallery  -> ${gallery.photos.length} photographs`);
