/* ============================================================
   thadtakesphotos.com — site behavior
   ============================================================ */

/* ------------------------------------------------------------
   THE GALLERY LIST  ← the part you edit most often.
   Drop a file in public/photos/, add a line here, done.
     src   : path to the file
     alt   : what's in the photo. Never displayed — it's what a screen
             reader announces and what a search engine indexes, so
             describe it properly even though no visitor sees it.
     ratio : height ÷ width as a percent. 150 is a 2:3 portrait
             straight out of the camera, 125 is a 4:5 crop, 100 is
             square. It reserves the right amount of space before the
             image loads, which is what stops the page jumping around.

   Order is running order on the page, strongest first — visitors
   judge a photographer by the first two frames and many never scroll
   past them. The ratios are deliberately interleaved so the masonry
   grid doesn't stack three tall frames down one column.
------------------------------------------------------------ */
const PHOTOS = [
  { src: "photos/portrait-02.jpg", alt: "Senior seated in dry grass, red sandstone ridges catching the last light in the distance",               ratio: 150 },
  { src: "photos/portrait-06.jpg", alt: "Senior seated in a meadow holding a violin and bow, red rock hogbacks lit gold behind her",              ratio: 66 },
  { src: "photos/portrait-03.jpg", alt: "Senior holding a pink rose, open grassland and sandstone hills stretching out behind",                   ratio: 150 },
  { src: "photos/portrait-05.jpg", alt: "Senior seated in a summer meadow beneath a cottonwood, hillside and open sky behind",                    ratio: 125 },
  { src: "photos/portrait-08.jpg", alt: "Close portrait of a senior raising a violin bow to the strings, red rock cliffs soft behind",            ratio: 66 },
  { src: "photos/portrait-07.jpg", alt: "Senior seen from behind in a lace-back black dress, looking out across the meadow toward the red rocks",  ratio: 66 },
  { src: "photos/portrait-01.jpg", alt: "Senior in a black dress standing in tall grass below the foothills, backlit by low evening sun",         ratio: 150 },
  { src: "photos/portrait-04.jpg", alt: "Senior in a black dress standing waist-deep in golden summer grass, green foothills rising behind her",  ratio: 66 },
];

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ── Build the gallery ───────────────────────────────────── */
const gallery = $("#gallery");

PHOTOS.forEach((photo, i) => {
  const tile = document.createElement("button");
  tile.className = "tile";
  tile.type = "button";
  tile.style.setProperty("--ratio", photo.ratio + "%");
  tile.dataset.index = i;
  tile.dataset.src = photo.src.replace("photos/", "");
  tile.setAttribute("aria-label", `Open photo: ${photo.alt}`);

  const img = new Image();
  img.src = photo.src;
  img.alt = photo.alt;
  img.loading = i < 4 ? "eager" : "lazy";
  img.decoding = "async";
  img.addEventListener("load", () => img.classList.add("is-loaded"));
  // Until a real file exists at that path, leave the warm placeholder showing.
  img.addEventListener("error", () => {
    img.remove();
    tile.classList.add("tile--empty");
  });

  tile.append(img);
  tile.addEventListener("click", () => openLightbox(i));
  gallery.append(tile);
});

// No photos yet — say so plainly rather than leaving a blank gap.
if (PHOTOS.length === 0) {
  const empty = document.createElement("p");
  empty.className = "gallery__empty";
  empty.textContent = "Photographs coming soon.";
  gallery.append(empty);
}

/* ── Lightbox ────────────────────────────────────────────── */
const lightbox = $("#lightbox");
const lbImg    = $("#lightbox-img");
let lbIndex = 0;
let lastFocused = null;

function visibleIndexes() {
  return $$(".tile", gallery).map(t => Number(t.dataset.index));
}

function showPhoto(index) {
  const photo = PHOTOS[index];
  if (!photo) return;
  lbIndex = index;
  lbImg.src = photo.src;
  lbImg.alt = photo.alt;
}

function openLightbox(index) {
  lastFocused = document.activeElement;
  showPhoto(index);
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => lightbox.classList.add("is-open"));
  $(".lightbox__close").focus();
}

function closeLightbox() {
  lightbox.classList.remove("is-open");
  document.body.style.overflow = "";
  setTimeout(() => { lightbox.hidden = true; lbImg.removeAttribute("src"); }, 300);
  lastFocused?.focus();
}

function step(dir) {
  // Walk only through photos currently passing the filter, wrapping at the ends.
  const list = visibleIndexes();
  if (!list.length) return;
  const at = list.indexOf(lbIndex);
  showPhoto(list[(at + dir + list.length) % list.length]);
}

$(".lightbox__close").addEventListener("click", closeLightbox);
$(".lightbox__nav--prev").addEventListener("click", () => step(-1));
$(".lightbox__nav--next").addEventListener("click", () => step(1));
lightbox.addEventListener("click", e => { if (e.target === lightbox) closeLightbox(); });

document.addEventListener("keydown", e => {
  if (lightbox.hidden) return;
  if (e.key === "Escape")     closeLightbox();
  if (e.key === "ArrowLeft")  step(-1);
  if (e.key === "ArrowRight") step(1);
});

/* ── Nav: transparent over the hero, solid once scrolled ─── */
const nav = $("#nav");
const hero = $(".hero");

const heroWatcher = new IntersectionObserver(
  ([entry]) => {
    const overHero = entry.isIntersecting;
    nav.classList.toggle("nav--top", overHero);
    nav.classList.toggle("nav--stuck", !overHero);
  },
  { rootMargin: "-70px 0px 0px 0px" }
);
heroWatcher.observe(hero);

/* ── Mobile menu ─────────────────────────────────────────── */
const toggle = $(".nav__toggle");
const mobile = $("#nav-mobile");

toggle.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") === "true";
  toggle.setAttribute("aria-expanded", String(!open));
  toggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
  mobile.hidden = open;
  nav.classList.toggle("nav--open", !open);
});

$$("a", mobile).forEach(link => link.addEventListener("click", () => {
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Open menu");
  mobile.hidden = true;
  nav.classList.remove("nav--open");
}));

/* ── Scroll reveal ───────────────────────────────────────── */
if ("IntersectionObserver" in window) {
  const revealer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -60px 0px" });

  $$(".reveal").forEach(el => revealer.observe(el));

  // Failsafe: if the observer has reported nothing at all shortly after load,
  // something is wrong with it — show everything rather than leave a blank page.
  window.addEventListener("load", () => setTimeout(() => {
    if (!$(".reveal.is-in")) $$(".reveal").forEach(el => el.classList.add("is-in"));
  }, 1200));
} else {
  $$(".reveal").forEach(el => el.classList.add("is-in"));
}

/* ── Background photos declared in the HTML ──────────────── */
// Any element with data-photo gets that image as its background, but only
// if the file actually exists — otherwise the CSS gradient stays.
$$("[data-photo]").forEach(el => {
  const probe = new Image();
  probe.addEventListener("load", () => {
    el.style.backgroundImage = `url("${el.dataset.photo}")`;
  });
  probe.src = el.dataset.photo;
});

/* ── Contact form ─────────────────────────────────────────────
   Posts to the service named in the form's action and never leaves
   the page. No address is published anywhere on the site, so if this
   ever fails the visitor is asked to retry rather than pointed at an
   inbox — see README step 3 for the endpoint setup.
------------------------------------------------------------ */
const form   = $("#contact-form");
const status = $("#form-status");

form.addEventListener("submit", async e => {
  e.preventDefault();

  const button = $("button[type=submit]", form);
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "Sending…";
  status.className = "form__status";
  status.textContent = "";

  try {
    const res = await fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    form.reset();
    status.className = "form__status is-ok";
    status.textContent = "Got it — thanks. I'll be in touch.";
  } catch (err) {
    status.className = "form__status is-err";
    status.textContent = "That didn't send. Please try again, or reach me on Instagram.";
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
});

/* ── Footer year ─────────────────────────────────────────── */
$("#year").textContent = new Date().getFullYear();
