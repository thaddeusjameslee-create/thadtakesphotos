/* ============================================================
   Scroll-driven exploded camera
   ------------------------------------------------------------
   A stylised 35mm SLR built out of primitives. Scrolling the
   pinned section takes it from assembled, out to an exploded
   view, and back together again. Every piece is its own mesh,
   which is the whole reason this is buildable in code — an
   exploded view needs parts that were never merged.

   Loaded on demand by main.js, and only when the device can
   run it. If anything here throws, the section stays hidden
   and the rest of the page is unaffected.
   ============================================================ */

import * as THREE from "./vendor/three.module.min.js";

const CFG = {
  camZ:       14,     // camera distance
  viewHeight: 11,     // world units visible top to bottom
  spread:     3.4,    // how far parts fly apart at full explosion
  ease:       0.09,   // how lazily it follows the scroll
  spin:       1.15,   // radians of turntable rotation across the section
};

/* Palette, pulled from the site's CSS so the model belongs to the page. */
const COLOR = {
  body:   0x1b1915,
  panel:  0x111010,
  metal:  0x9a9184,
  accent: 0xb4552f,
  glass:  0x24384a,
};

export function initCamera3D({ section, canvas, caption }) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: "high-performance",
  });
  renderer.setClearAlpha(0);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 0, CFG.camZ);

  const rig = new THREE.Group();          // everything rotates as one
  scene.add(rig);

  /* ── Materials ──────────────────────────────────────────── */
  const mat = {
    body:   new THREE.MeshStandardMaterial({ color: COLOR.body,   metalness: 0.30, roughness: 0.62 }),
    panel:  new THREE.MeshStandardMaterial({ color: COLOR.panel,  metalness: 0.15, roughness: 0.88 }),
    metal:  new THREE.MeshStandardMaterial({ color: COLOR.metal,  metalness: 0.92, roughness: 0.28 }),
    accent: new THREE.MeshStandardMaterial({ color: COLOR.accent, metalness: 0.45, roughness: 0.42 }),
    glass:  new THREE.MeshStandardMaterial({
      color: COLOR.glass, metalness: 0.95, roughness: 0.06,
      transparent: true, opacity: 0.9,
    }),
  };

  /* ── Parts ──────────────────────────────────────────────────
     Each entry: geometry, material, resting position, and the
     direction it travels when the camera comes apart. Directions
     are hand-set rather than derived from position so the lens
     stack pulls forward along its own axis instead of splaying.
  ------------------------------------------------------------ */
  const box  = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const tube = (rt, rb, h, seg = 40) => new THREE.CylinderGeometry(rt, rb, h, seg);

  const PARTS = [
    // ── body shell
    { name: "body",        geo: box(4.0, 2.3, 1.5),        mat: "body",   at: [0, 0, 0],          to: [0, 0, 0] },
    { name: "front plate", geo: box(4.0, 2.3, 0.12),       mat: "panel",  at: [0, 0, 0.78],       to: [0, 0.2, 1.5] },
    { name: "film door",   geo: box(3.7, 2.1, 0.14),       mat: "panel",  at: [0, 0, -0.8],       to: [-0.4, 0, -2.4] },
    { name: "base plate",  geo: box(4.0, 0.16, 1.5),       mat: "metal",  at: [0, -1.22, 0],      to: [0, -2.2, 0] },
    { name: "top plate",   geo: box(3.4, 0.18, 1.4),       mat: "metal",  at: [0, 1.2, 0],        to: [0, 1.9, 0] },

    // ── viewfinder
    { name: "pentaprism",  geo: tube(0.55, 0.92, 0.85, 4), mat: "metal",  at: [0, 1.68, -0.05],   to: [0, 3.0, -0.4], spin: Math.PI / 4 },
    { name: "hot shoe",    geo: box(0.62, 0.14, 0.5),      mat: "metal",  at: [0, 2.16, -0.05],   to: [0, 3.9, -0.5] },
    { name: "eyepiece",    geo: tube(0.3, 0.3, 0.22, 24),  mat: "panel",  at: [0, 1.55, -0.82],   to: [0, 2.2, -2.6], tip: true },

    // ── lens stack, pulling straight out the front
    { name: "mount ring",  geo: tube(1.02, 1.02, 0.2, 44), mat: "metal",  at: [0, 0, 0.9],        to: [0, 0, 2.0], tip: true },
    { name: "lens barrel", geo: tube(0.86, 0.92, 1.5, 44), mat: "body",   at: [0, 0, 1.72],       to: [0, 0, 3.6], tip: true },
    { name: "focus ring",  geo: tube(0.97, 0.97, 0.46, 44),mat: "accent", at: [0, 0, 1.95],       to: [0, 0, 5.0], tip: true },
    { name: "front ring",  geo: tube(0.9, 0.9, 0.16, 44),  mat: "metal",  at: [0, 0, 2.5],        to: [0, 0, 6.3], tip: true },
    { name: "glass",       geo: tube(0.76, 0.76, 0.1, 44), mat: "glass",  at: [0, 0, 2.52],       to: [0, 0, 7.4], tip: true },

    // ── controls
    { name: "shutter dial",geo: tube(0.34, 0.34, 0.22, 30),mat: "metal",  at: [1.15, 1.4, -0.2],  to: [2.4, 2.6, -0.5] },
    { name: "shutter",     geo: tube(0.14, 0.14, 0.14, 20),mat: "accent", at: [1.15, 1.56, 0.35], to: [2.0, 3.2, 1.1] },
    { name: "rewind knob", geo: tube(0.3, 0.3, 0.24, 30),  mat: "metal",  at: [-1.4, 1.42, -0.1], to: [-2.7, 2.7, -0.4] },
    { name: "advance",     geo: box(0.85, 0.09, 0.26),     mat: "metal",  at: [1.6, 1.34, -0.55], to: [3.3, 1.8, -1.6] },

    // ── grip and lugs
    { name: "grip",        geo: box(0.75, 2.3, 1.6),       mat: "panel",  at: [2.06, 0, 0.05],    to: [3.6, 0, 0.4] },
    { name: "lug left",    geo: box(0.22, 0.3, 0.16),      mat: "metal",  at: [-2.06, 0.92, 0],   to: [-3.4, 1.6, 0] },
    { name: "lug right",   geo: box(0.22, 0.3, 0.16),      mat: "metal",  at: [2.5, 0.92, 0],     to: [4.2, 1.6, 0] },
  ];

  const parts = PARTS.map(spec => {
    const mesh = new THREE.Mesh(spec.geo, mat[spec.mat]);

    // Cylinders are built along Y. `tip` lays one down to point along Z,
    // which is what the lens stack and the eyepiece need.
    if (spec.tip) mesh.rotation.x = Math.PI / 2;
    if (spec.spin) mesh.rotation.y = spec.spin;

    mesh.position.set(...spec.at);
    rig.add(mesh);

    return {
      mesh,
      name: spec.name,
      home: new THREE.Vector3(...spec.at),
      away: new THREE.Vector3(...spec.to),
      baseRot: mesh.rotation.clone(),
    };
  });

  /* ── Lighting ───────────────────────────────────────────── */
  scene.add(new THREE.HemisphereLight(0xfbf6ee, 0x4a3f33, 0.85));

  const key = new THREE.DirectionalLight(0xfff4e2, 2.1);
  key.position.set(5, 6, 7);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xcfd8e6, 0.75);
  fill.position.set(-6, 1, 3);
  scene.add(fill);

  // Warm kicker from behind, so edges catch the site's clay accent.
  const rim = new THREE.DirectionalLight(0xb4552f, 1.5);
  rim.position.set(-2, -3, -6);
  scene.add(rim);

  /* ── State ──────────────────────────────────────────────── */
  let W = 0, H = 0;
  let explode = 0, targetExplode = 0;
  let progress = 0;
  let running = false;
  let disposed = false;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    if (!W || !H) return;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H, false);

    camera.aspect = W / H;
    camera.fov = 2 * Math.atan((CFG.viewHeight / 2) / CFG.camZ) * (180 / Math.PI);
    camera.updateProjectionMatrix();

    // Narrow screens: pull back so the exploded spread still fits.
    rig.scale.setScalar(camera.aspect < 1 ? 0.62 : 1);
  }

  function readProgress() {
    const rect = section.getBoundingClientRect();
    const travel = section.offsetHeight - window.innerHeight;
    if (travel <= 0) return 0;
    return Math.min(Math.max(-rect.top / travel, 0), 1);
  }

  /* Together → apart → together. A sine over the section gives exactly that,
     peaking at the midpoint and returning to zero at both ends. */
  function explosionFor(p) {
    return Math.sin(Math.min(Math.max(p, 0), 1) * Math.PI);
  }

  function apply() {
    parts.forEach(part => {
      part.mesh.position.lerpVectors(part.home, part.away, explode * (CFG.spread / 3.4));

      // Parts tumble slightly as they separate, then settle square again.
      part.mesh.rotation.x = part.baseRot.x + explode * 0.22;
      part.mesh.rotation.z = part.baseRot.z + explode * 0.16;
    });

    rig.rotation.y = -0.45 + progress * CFG.spin;
    rig.rotation.x = 0.16 - explode * 0.1;

    if (caption) {
      const showing = explode > 0.35;
      caption.textContent = showing ? `${parts.length} parts` : "";
      caption.classList.toggle("is-on", showing);
    }
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);

    progress = readProgress();
    targetExplode = explosionFor(progress);
    explode += (targetExplode - explode) * CFG.ease;

    apply();
    renderer.render(scene, camera);
  }

  /* Only burn frames while the section is actually on screen. */
  const visibility = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) { running = true; frame(); }
    else if (!entry.isIntersecting) { running = false; }
  }, { rootMargin: "150px 0px" });

  visibility.observe(section);

  /* The canvas can have no size at all when this runs — its section may still
     have been display:none a moment ago. Watching the element itself catches
     the size whenever it actually arrives, which a window resize listener
     alone never would. */
  const sizeWatcher = new ResizeObserver(() => {
    resize();
    if (!running) { apply(); renderer.render(scene, camera); }
  });
  sizeWatcher.observe(canvas);

  // Device-pixel-ratio changes (dragging to another monitor) don't move the
  // element, so they need the window event too.
  window.addEventListener("resize", resize, { passive: true });

  resize();

  // Paint the assembled state immediately rather than showing an empty canvas
  // until the observer fires.
  progress = readProgress();
  explode = targetExplode = explosionFor(progress);
  apply();
  renderer.render(scene, camera);

  return {
    destroy() {
      disposed = true;
      running = false;
      visibility.disconnect();
      sizeWatcher.disconnect();
      window.removeEventListener("resize", resize);
      parts.forEach(p => p.mesh.geometry.dispose());
      Object.values(mat).forEach(m => m.dispose());
      renderer.dispose();
    },
  };
}
