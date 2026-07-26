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

import * as THREE from "../vendor/three.module.min.js";

const CFG = {
  camZ:       14,     // camera distance
  viewHeight: 11,     // world units visible top to bottom
  spread:     2.6,    // how far parts fly apart at full explosion
  ease:       0.16,   // how tightly it tracks the scroll; higher = snappier
  maxScale:   0.62,   // ceiling on size, even when there's room to spare
  fitMargin:  0.92,   // fraction of the frame the exploded view may occupy
  clearance:  0.55,   // gap kept between the flung parts and the portrait ring
  spin:       1.15,   // radians of turntable rotation across the section

  // The three portraits circling the camera.
  orbitRadius: 6.9,   // how wide the circle is
  orbitTilt:   0.32,  // lifts the circle into an ellipse rather than a flat ring
  orbitTurns:  1,     // full revolutions across the section — lower is slower
  orbitPhase: -Math.PI / 2,  // start with one behind the camera, not in your face
  portraitH:   4.0,   // portrait height in world units
  portraitAR:  0.667, // width ÷ height — 2:3, the native portrait ratio out of
                      // a DSLR, so your framing isn't cropped to fit the panel
  portraitPush: 1.3,  // how much the circle widens at full explosion
};

/* Drop real files at these paths and they replace the placeholders with no
   code change. Portrait crops — that's the whole point of them. */
const PORTRAITS = [
  "photos/portrait-01.jpg",
  "photos/portrait-02.jpg",
  "photos/portrait-03.jpg",
];

/* Palette, pulled from the site's CSS so the model belongs to the page. */
const COLOR = {
  body:   0x1b1915,
  panel:  0x111010,
  metal:  0x9a9184,
  accent: 0xb4552f,
  glass:  0x24384a,
};

/* A stand-in portrait: warm vertical gradient with its slot number on it, so
   an empty slot still looks deliberate rather than broken. */
function placeholderPortrait(label) {
  const c = document.createElement("canvas");
  c.width = 720; c.height = 1000;
  const g = c.getContext("2d");

  const grad = g.createLinearGradient(0, 0, c.width * 0.4, c.height);
  grad.addColorStop(0, "#d7ccbb");
  grad.addColorStop(1, "#8d7a60");
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);

  g.fillStyle = "rgba(23,21,15,.34)";
  g.textAlign = "center";
  g.font = "500 34px Inter, system-ui, sans-serif";
  g.fillText(label.toUpperCase(), c.width / 2, c.height / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function loadTexture(src) {
  return new Promise(resolve => {
    new THREE.TextureLoader().load(
      src,
      tex => { tex.colorSpace = THREE.SRGBColorSpace; resolve(tex); },
      undefined,
      () => resolve(null)   // no file there yet — keep the placeholder
    );
  });
}

export function initCamera3D({ section, canvas }) {
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

  /* How far the model reaches at full explosion, measured from the geometry
     rather than guessed. Bounding spheres are rotation-proof, so a part that
     gets tumbled as it separates can't poke outside what we measured. This is
     what lets resize() pick a scale that provably fits any frame. */
  const spreadFactor = CFG.spread / 3.4;   // must match the lerp in apply()

  let exHalfW = 0, exHalfH = 0, exRadius = 0;
  parts.forEach(p => {
    p.mesh.geometry.computeBoundingSphere();
    const reach = p.mesh.geometry.boundingSphere.radius;
    const at = p.away.clone().multiplyScalar(spreadFactor);

    exHalfW = Math.max(exHalfW, Math.abs(at.x) + reach);
    exHalfH = Math.max(exHalfH, Math.abs(at.y) + reach);
    // Distance from the origin in 3D — this is what the orbiting panels have
    // to stay outside of. The lens stack dominates it: it flies straight
    // toward the viewer, which is radially outward as far as the ring cares.
    exRadius = Math.max(exRadius, at.length() + reach);
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

  /* ── Orbiting portraits ─────────────────────────────────────
     Three portrait panels circling the camera, each a photo plane on a
     slightly larger ivory backing so it reads as a print rather than a
     floating rectangle. They sit in the scene rather than in `rig`, so their
     orbit is independent of the camera's own turntable spin.

     Unlit (MeshBasicMaterial) on purpose — a photograph should look like the
     photograph, not like it's being lit by the scene's key light.
  ------------------------------------------------------------ */
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  const pH = CFG.portraitH;
  const pW = pH * CFG.portraitAR;

  const orbiters = PORTRAITS.map((src, i) => {
    const group = new THREE.Group();

    const photoMat = new THREE.MeshBasicMaterial({
      map: placeholderPortrait(`portrait ${String(i + 1).padStart(2, "0")}`),
      toneMapped: false,
    });
    const photo = new THREE.Mesh(unitPlane, photoMat);
    photo.scale.set(pW, pH, 1);

    const frameMat = new THREE.MeshBasicMaterial({ color: 0xf7f3ec, toneMapped: false });
    const frame = new THREE.Mesh(unitPlane, frameMat);
    frame.scale.set(pW + 0.2, pH + 0.2, 1);
    frame.position.z = -0.012;

    // Both faces visible, so a panel swinging behind the camera still shows.
    photoMat.side = frameMat.side = THREE.DoubleSide;

    group.add(frame, photo);
    scene.add(group);

    loadTexture(src).then(tex => {
      if (disposed || !tex) return;
      photoMat.map.dispose();
      photoMat.map = tex;
      photoMat.needsUpdate = true;
    });

    return { group, photoMat, frameMat };
  });

  /* ── State ──────────────────────────────────────────────── */
  let W = 0, H = 0;
  let rigScale = 1;
  let portraitScale = 1;
  let orbitR = CFG.orbitRadius;
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

    const visibleW = CFG.viewHeight * camera.aspect;
    const limit    = visibleW * 0.5 * CFG.fitMargin;

    /* Panels are sized from the frame, not from the camera's scale. The ring
       wants to stay as wide as the frame allows — shrinking it in step with
       the camera would defeat the whole point of separating them. */
    const panelScale = Math.min(1, visibleW / 16);
    const panelW = CFG.portraitH * CFG.portraitAR * panelScale;
    portraitScale = panelScale;

    /* Size the camera first, from the frame alone: the fully exploded model
       has to fit on both axes. */
    const fitW = limit / exHalfW;
    const fitH = (CFG.viewHeight * 0.5 * CFG.fitMargin) / exHalfH;
    rigScale = Math.min(CFG.maxScale, fitW, fitH);
    rig.scale.setScalar(rigScale);

    /* Then put the ring outside it. Deriving the ring from the camera — rather
       than the camera from the ring — is the whole trick. The other way round,
       a narrow phone frame forces a small ring, which forces a camera so tiny
       it disappears. This way the camera stays legible at any width and the
       ring simply moves out to clear it.

       exRadius is the model's fully-exploded bounding radius, so subtracting
       the push it hasn't received yet leaves a resting radius that still keeps
       its distance at the moment the parts are flung furthest. */
    const needed = exRadius * rigScale + CFG.clearance + panelW / 2;
    orbitR = Math.max(needed - CFG.portraitPush, panelW * 0.75);
  }

  function readProgress() {
    const rect = section.getBoundingClientRect();

    // Measure against the sticky pane's own height, NOT window.innerHeight.
    // Mobile browsers grow and shrink innerHeight as the address bar hides,
    // which would silently rescale the whole animation mid-scroll and make it
    // lurch. H comes from the canvas, which is sized in svh and stays put.
    const travel = section.offsetHeight - H;
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
      part.mesh.position.lerpVectors(part.home, part.away, explode * spreadFactor);

      // Parts tumble slightly as they separate, then settle square again.
      part.mesh.rotation.x = part.baseRot.x + explode * 0.22;
      part.mesh.rotation.z = part.baseRot.z + explode * 0.16;
    });

    rig.rotation.y = -0.45 + progress * CFG.spin;
    rig.rotation.x = 0.16 - explode * 0.1;

    // Portraits ride an inclined circle: the tilt term lifts one side so it
    // reads as an ellipse in perspective instead of a flat ring edge-on. The
    // circle also widens as the camera comes apart, so the two motions don't
    // fight for the same space.
    const radius = orbitR + explode * CFG.portraitPush;

    orbiters.forEach(({ group }, i) => {
      const a = CFG.orbitPhase
              + (i * Math.PI * 2) / orbiters.length
              + progress * Math.PI * 2 * CFG.orbitTurns;

      group.position.set(
        Math.cos(a) * radius,
        Math.sin(a) * CFG.orbitTilt * radius,
        Math.sin(a) * radius
      );
      group.scale.setScalar(portraitScale);
      group.lookAt(camera.position);   // keep them square to the viewer
    });
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
  // Resizing clears the drawing buffer, so anything that resizes must repaint
  // too — otherwise a resize while the loop is idle leaves a blank canvas.
  const handleResize = () => {
    resize();
    if (!running) { apply(); renderer.render(scene, camera); }
  };

  const sizeWatcher = new ResizeObserver(handleResize);
  sizeWatcher.observe(canvas);

  // Device-pixel-ratio changes (dragging to another monitor) don't move the
  // element, so they need the window event too.
  window.addEventListener("resize", handleResize, { passive: true });

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
      window.removeEventListener("resize", handleResize);
      parts.forEach(p => p.mesh.geometry.dispose());
      Object.values(mat).forEach(m => m.dispose());
      orbiters.forEach(o => {
        o.photoMat.map?.dispose();
        o.photoMat.dispose();
        o.frameMat.dispose();
      });
      unitPlane.dispose();
      renderer.dispose();
    },
  };
}
