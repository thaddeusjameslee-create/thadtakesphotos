/* ============================================================
   thadtakesphotos.com — site behavior
   ============================================================ */

/* ------------------------------------------------------------
   1. THE GALLERY LIST  ← this is the part you edit most often.
   Drop your files in /photos, then add a line here.
     src   : path to the file
     alt   : description (also shown under the lightbox)
     tag   : outdoor | urban | sports | studio   (drives the filters)
     ratio : height ÷ width, as a %. 125 = portrait, 75 = landscape,
             100 = square. Only affects the placeholder box before
             the image loads, so eyeballing it is fine.
------------------------------------------------------------ */
// PLACEHOLDERS — these are landscape test shots, not senior portraits.
// Swap them out as real sessions come in: drop files in public/photos/ and
// edit the lines below. `ratio` is height ÷ width as a percent, so 75 is a
// 4:3 landscape and 125 is a portrait. Both the grid and the 3D strip read it.
const PHOTOS = [
  { src: "photos/01.jpg", alt: "Sunrise over a snowfield, frost catching the light", ratio: 75 },
  { src: "photos/02.jpg", alt: "Last light on a rocky ridge above the treeline",     ratio: 75 },
  { src: "photos/03.jpg", alt: "Sailboats anchored in a harbour at sunset",          ratio: 75 },
  { src: "photos/04.jpg", alt: "A rainbow over a green mountain valley",             ratio: 75 },
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
  tile.dataset.tag = photo.tag;
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

  const label = document.createElement("span");
  label.className = "tile__label";
  label.textContent = photo.alt;

  tile.append(img, label);
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

/* ── Filters ─────────────────────────────────────────────── */
$$(".filter").forEach(btn => {
  btn.addEventListener("click", () => {
    const want = btn.dataset.filter;

    $$(".filter").forEach(b => {
      const on = b === btn;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });

    $$(".tile", gallery).forEach(tile => {
      tile.classList.toggle("is-hidden", want !== "all" && tile.dataset.tag !== want);
    });
  });
});

/* ── Lightbox ────────────────────────────────────────────── */
const lightbox = $("#lightbox");
const lbImg    = $("#lightbox-img");
const lbCap    = $("#lightbox-cap");
let lbIndex = 0;
let lastFocused = null;

function visibleIndexes() {
  return $$(".tile", gallery).filter(t => !t.classList.contains("is-hidden"))
                             .map(t => Number(t.dataset.index));
}

function showPhoto(index) {
  const photo = PHOTOS[index];
  if (!photo) return;
  lbIndex = index;
  lbImg.src = photo.src;
  lbImg.alt = photo.alt;
  lbCap.textContent = photo.alt;
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

/* ── Contact form (AJAX so the page never navigates away) ── */
const form   = $("#contact-form");
const status = $("#form-status");

form.addEventListener("submit", async e => {
  e.preventDefault();

  if (form.action.includes("YOUR_FORM_ID")) {
    status.className = "form__status is-err";
    status.textContent = "Form isn't connected yet — see step 3 in the README.";
    return;
  }

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
    // No fallback address here until there's a real one to publish.
    status.className = "form__status is-err";
    status.textContent = "Something went wrong sending that. Please try again.";
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
});

/* ── Footer year ─────────────────────────────────────────── */
$("#year").textContent = new Date().getFullYear();

/* ── 3D ──────────────────────────────────────────────────────
   Two independent WebGL scenes: the exploded camera and the photo
   strip. Both are strictly enhancements — the page is complete
   without either, and each is skipped if the device can't drive
   it or if loading Three.js fails.
------------------------------------------------------------ */
function canRun3D() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  // Bail on low-end hardware rather than hand someone a 12fps slideshow.
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return false;
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

if (canRun3D()) {

  /* ── The exploded camera ───────────────────────────────────
     Its section sits second on the page, and a `hidden` element has
     no layout box for an observer to watch — so this loads shortly
     after the page settles rather than on scroll.
  ---------------------------------------------------------- */
  const cameraSection = $("#camera-section");

  // Reveal it NOW, before the module loads. Revealing it later would drop a
  // couple of screens of content into the page while the visitor is already
  // scrolling, shoving everything below them and reading as a hard jolt.
  // Claiming the space up front keeps the page height stable from the start.
  cameraSection.hidden = false;

  import("./camera3d.js")
    .then(({ initCamera3D }) => {
      initCamera3D({ section: cameraSection, canvas: $("#camera-canvas") });
    })
    .catch(err => {
      // Put the space back rather than leave two screens of blank page.
      cameraSection.hidden = true;
      console.warn("Camera scene unavailable.", err);
    });

  /* ── The photo strip ───────────────────────────────────────
     Only worth loading if there are photos to put on it.
  ---------------------------------------------------------- */
  if (PHOTOS.length > 0) {
    const glSection = $("#gl-section");
    const toggle3d  = $("#view-toggle");

    const loadStrip = () => import("./gallery3d.js")
      .then(({ initGallery3D }) => {
        glSection.hidden = false;
        document.body.classList.add("has-3d");

        initGallery3D({
          photos:  PHOTOS,
          onOpen:  openLightbox,
          section: glSection,
          canvas:  $("#gl-canvas"),
          caption: $("#gl-caption"),
          filters: $$(".filter[data-filter]")
        });

        // Guarded: a missing toggle must never take the strip down with it.
        if (!toggle3d) return;
        toggle3d.hidden = false;
        toggle3d.addEventListener("click", () => {
          const on = document.body.classList.toggle("has-3d");
          glSection.hidden = !on;
          toggle3d.textContent = on ? "Grid view" : "3D view";
          toggle3d.setAttribute("aria-pressed", String(on));
        });
      })
      .catch(err => {
        // The grid is already on screen, so there's nothing to recover.
        console.warn("3D strip unavailable, staying with the grid.", err);
      });

    const trigger = new IntersectionObserver(([entry], obs) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      loadStrip();
    }, { rootMargin: "600px 0px" });

    trigger.observe($("#work"));
  }
}
