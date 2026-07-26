/* ============================================================
   Scroll-driven 3D gallery
   ------------------------------------------------------------
   Photos live on planes in a curved, infinitely-wrapping strip.
   Vertical page scroll walks the strip sideways; you can also
   grab and fling it. Loaded on demand by main.js — only when the
   browser can actually handle it. If anything here fails, the
   plain masonry grid stays on screen instead.
   ============================================================ */

import * as THREE from "../vendor/three.module.min.js";

/* Tunables — safe to fiddle with. */
const CFG = {
  camZ:        10,      // camera distance; also sets the world scale
  viewHeight:  10,      // world units visible top-to-bottom
  planeH:      5.0,     // baseline photo height in world units
  gapFactor:   0.16,    // gap between photos, as a multiple of that height
  curve:       0.055,   // how far the strip bows away at the edges
  twist:       0.055,   // how much each photo turns to face the middle
  ease:        0.075,   // strip inertia; lower = floatier
  maxVel:      1.4,     // clamp on the velocity that drives the distortion
  radius:      0.16,    // corner rounding, in world units
};

const vertexShader = /* glsl */ `
  uniform float uVelocity;
  uniform float uHover;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Bow the plane as the strip moves — the faster it travels, the more it
    // trails behind at the centre, like fabric caught in wind.
    float bend = sin(uv.x * 3.141592);
    pos.z -= bend * uVelocity * 1.6;
    pos.y += bend * abs(uVelocity) * 0.10;

    // Lift toward the viewer on hover.
    pos.z += uHover * 0.45;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTex;
  uniform vec2  uPlaneSize;
  uniform vec2  uImageSize;
  uniform float uVelocity;
  uniform float uHover;
  uniform float uOpacity;
  uniform float uEdge;      // 0 at centre screen, 1 out at the edges
  uniform float uRadius;
  varying vec2  vUv;

  // Equivalent of CSS object-fit: cover.
  vec2 coverUv(vec2 uv, vec2 plane, vec2 img) {
    vec2 r = vec2(
      min((plane.x / plane.y) / (img.x / img.y), 1.0),
      min((plane.y / plane.x) / (img.y / img.x), 1.0)
    );
    return uv * r + (1.0 - r) * 0.5;
  }

  // Signed distance to a rounded rectangle, for soft corners.
  float sdRoundRect(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  void main() {
    vec2 uv = coverUv(vUv, uPlaneSize, uImageSize);

    // Gentle push-in on hover.
    uv = (uv - 0.5) * (1.0 - uHover * 0.05) + 0.5;

    // Colour fringing that scales with how fast the strip is moving.
    float shift = clamp(uVelocity, -1.0, 1.0) * 0.010;
    vec3 col;
    col.r = texture2D(uTex, uv + vec2(shift, 0.0)).r;
    col.g = texture2D(uTex, uv).g;
    col.b = texture2D(uTex, uv - vec2(shift, 0.0)).b;

    // Photos out at the edges sit back into the warm page colour.
    vec3 paper = vec3(0.937, 0.910, 0.871);
    col = mix(col, paper, uEdge * 0.55);
    col = mix(col, col * 1.06, uHover);

    float d = sdRoundRect((vUv - 0.5) * uPlaneSize, uPlaneSize * 0.5, uRadius);
    float alpha = 1.0 - smoothstep(-0.006, 0.006, d);

    gl_FragColor = vec4(col, alpha * uOpacity);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

/* A stand-in texture for photos that don't exist yet: warm gradient,
   filename printed on it, so empty slots still look deliberate. */
function placeholderTexture(label) {
  const c = document.createElement("canvas");
  c.width = 720; c.height = 1000;
  const g = c.getContext("2d");

  const grad = g.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, "#D9CFC0");
  grad.addColorStop(1, "#94805F");
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);

  g.fillStyle = "rgba(23,21,15,.34)";
  g.font = "500 30px Inter, system-ui, sans-serif";
  g.textAlign = "center";
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
      () => resolve(null)   // missing file — caller falls back
    );
  });
}

export function initGallery3D({ photos, onOpen, section, canvas, caption, filters }) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: "high-performance"
  });
  renderer.setClearAlpha(0);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = CFG.camZ;

  const raycaster = new THREE.Raycaster();
  const pointer   = new THREE.Vector2(-10, -10);

  let W = 0, H = 0, visibleW = 0;
  let baseH = 0, gap = 0, stripW = 0;
  let offset = 0, target = 0, velocity = 0, dragDelta = 0;
  let hovered = null;
  let running = false;
  let disposed = false;

  const items = [];

  /* ── Build one mesh per photo ───────────────────────────── */
  const geometry = new THREE.PlaneGeometry(1, 1, 24, 24);

  photos.forEach((photo, index) => {
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      uniforms: {
        uTex:       { value: placeholderTexture(photo.src.split("/").pop()) },
        uPlaneSize: { value: new THREE.Vector2(1, 1) },
        uImageSize: { value: new THREE.Vector2(720, 1000) },
        uVelocity:  { value: 0 },
        uHover:     { value: 0 },
        uOpacity:   { value: 1 },
        uEdge:      { value: 0 },
        uRadius:    { value: CFG.radius },
      },
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { index, photo, baseX: 0, active: true, hover: 0, targetOpacity: 1 };
    scene.add(mesh);
    items.push(mesh);

    // Swap in the real photo once it arrives; keep the placeholder if it 404s.
    loadTexture(photo.src).then(tex => {
      if (disposed || !tex) return;
      material.uniforms.uTex.value.dispose();
      material.uniforms.uTex.value = tex;
      material.uniforms.uImageSize.value.set(tex.image.width, tex.image.height);
    });
  });

  /* ── Sizing ─────────────────────────────────────────────────
     Each photo is sized from its own `ratio`, so a landscape shot and a
     portrait one can sit on the strip together without either being cropped
     to fit a single shared shape. Positions accumulate rather than sitting on
     a fixed pitch, which is what keeps the gaps even when widths differ.
  ------------------------------------------------------------ */
  function sizeItem(mesh) {
    // ratio is height ÷ width as a percent; invert it to get width ÷ height.
    const wh = 100 / (mesh.userData.photo.ratio || 125);

    let h = baseH;
    let w = h * wh;

    // Never let a wide photo run past the edges of the viewport.
    const maxW = visibleW * 0.86;
    if (w > maxW) { w = maxW; h = w / wh; }

    mesh.scale.set(w, h, 1);
    mesh.material.uniforms.uPlaneSize.value.set(w, h);
    mesh.userData.width = w;
  }

  function layout() {
    const active = items.filter(m => m.userData.active);

    let cursor = 0;
    active.forEach(mesh => {
      const w = mesh.userData.width || 1;
      cursor += w / 2;              // walk to this photo's centre
      mesh.userData.baseX = cursor;
      cursor += w / 2 + gap;        // then past it, plus the gap
    });

    stripW = Math.max(cursor, 1);
  }

  /* Put one photo where it belongs for the current scroll offset. Shared by
     the frame loop and the very first paint, so both agree — an earlier
     version positioned the first frame without the wrap and bunched every
     photo off to one side until the loop took over. */
  function place(mesh) {
    const half = stripW / 2;

    // Wrap into [-half, half) so the strip never runs out.
    let x = (mesh.userData.baseX - offset) % stripW;
    if (x < 0) x += stripW;
    if (x > half) x -= stripW;

    mesh.position.x = x;
    mesh.position.z = -CFG.curve * x * x;
    mesh.rotation.y = -x * CFG.twist;

    // Fade and desaturate photos heading off the sides.
    mesh.material.uniforms.uEdge.value = Math.min(Math.abs(x) / (visibleW * 0.75), 1);
    mesh.visible = Math.abs(x) < visibleW * 1.2;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    if (!W || !H) return;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H, false);

    camera.aspect = W / H;
    // Lock the world scale to CFG.viewHeight regardless of window size.
    camera.fov = 2 * Math.atan((CFG.viewHeight / 2) / CFG.camZ) * (180 / Math.PI);
    camera.updateProjectionMatrix();

    visibleW = CFG.viewHeight * camera.aspect;

    // On a phone the strip should show roughly one photo at a time.
    const portrait = camera.aspect < 1;
    baseH = portrait ? CFG.viewHeight * 0.52 : CFG.planeH;
    gap   = baseH * CFG.gapFactor;

    items.forEach(sizeItem);
    layout();
  }

  /* ── Scroll → strip position ────────────────────────────── */
  function readScroll() {
    const rect = section.getBoundingClientRect();

    // H, not window.innerHeight — on mobile innerHeight changes as the address
    // bar hides, which would rescale the mapping mid-scroll and make the strip
    // lurch. The canvas height is set in svh and holds still.
    const travel = section.offsetHeight - H;
    if (travel <= 0) return 0;
    const p = Math.min(Math.max(-rect.top / travel, 0), 1);
    return p * stripW;
  }

  /* ── Pointer: hover, drag, click ────────────────────────── */
  let dragging = false, dragStartX = 0, dragMoved = 0, startDelta = 0;

  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    pointer.x =  ((e.clientX - r.left) / r.width)  * 2 - 1;
    pointer.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
  }

  function hitTest() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(
      items.filter(m => m.userData.active && m.material.uniforms.uOpacity.value > 0.5)
    );
    return hits.length ? hits[0].object : null;
  }

  canvas.addEventListener("pointerdown", e => {
    dragging = true;
    dragStartX = e.clientX;
    dragMoved = 0;
    startDelta = dragDelta;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("pointermove", e => {
    pointerPos(e);
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    dragMoved = Math.max(dragMoved, Math.abs(dx));
    // Convert pixels of drag into world units.
    dragDelta = startDelta - (dx / W) * visibleW * 1.6;
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    canvas.style.cursor = "grab";
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* already gone */ }

    // A press that barely moved is a click, not a drag. Raycast fresh from the
    // release point — touch devices never hover, so there's no `hovered` to lean on.
    if (dragMoved < 6) {
      pointerPos(e);
      const hit = hitTest();
      if (hit) onOpen(hit.userData.index);
    }
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => {
    pointer.set(-10, -10);
  });

  /* ── Filters drive which photos are in the strip ────────── */
  filters.forEach(btn => {
    btn.addEventListener("click", () => {
      const want = btn.dataset.filter;
      items.forEach(mesh => {
        const on = want === "all" || mesh.userData.photo.tag === want;
        mesh.userData.active = on;
        mesh.userData.targetOpacity = on ? 1 : 0;
      });
      layout();
    });
  });

  /* Position one photo for the current `offset`, wrapping it around the strip
     so the run never ends. Used by both the animation loop and the very first
     paint — they must agree, or that first frame lands in the wrong place. */
  function place(mesh) {
    const half = stripW / 2;

    let x = (mesh.userData.baseX - offset) % stripW;
    if (x < 0) x += stripW;
    if (x > half) x -= stripW;

    mesh.position.x = x;
    mesh.position.z = -CFG.curve * x * x;
    mesh.rotation.y = -x * CFG.twist;

    // Fade and desaturate photos heading off the sides.
    mesh.material.uniforms.uEdge.value = Math.min(Math.abs(x) / (visibleW * 0.75), 1);
    mesh.visible = Math.abs(x) < visibleW * 1.2;
  }

  /* ── Frame loop ─────────────────────────────────────────── */
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);

    target = readScroll() + dragDelta;

    const prev = offset;
    offset += (target - offset) * CFG.ease;
    velocity = THREE.MathUtils.clamp(offset - prev, -CFG.maxVel, CFG.maxVel);

    // Hover test — skipped mid-drag so the photo under your thumb doesn't flicker.
    const nextHover = (!dragging && pointer.x > -5) ? hitTest() : null;

    if (nextHover !== hovered) {
      hovered = nextHover;
      canvas.style.cursor = hovered ? "pointer" : "grab";
      caption.textContent = hovered ? hovered.userData.photo.alt : "";
      caption.classList.toggle("is-on", Boolean(hovered));
    }

    items.forEach(mesh => {
      const d = mesh.userData;

      if (d.active && stripW > 0) {
        place(mesh);
      } else {
        mesh.visible = false;
      }

      d.hover += ((hovered === mesh ? 1 : 0) - d.hover) * 0.12;
      mesh.material.uniforms.uHover.value = d.hover;
      mesh.material.uniforms.uVelocity.value = velocity;

      const o = mesh.material.uniforms.uOpacity;
      o.value += (d.targetOpacity - o.value) * 0.12;
      if (o.value < 0.01) mesh.visible = false;
    });

    renderer.render(scene, camera);
  }

  /* ── Only render while the gallery is actually on screen ── */
  const visibility = new IntersectionObserver(([entry]) => {
    const shouldRun = entry.isIntersecting;
    if (shouldRun && !running) { running = true; frame(); }
    else if (!shouldRun) { running = false; }
  }, { rootMargin: "150px 0px" });

  visibility.observe(section);

  /* Same reasoning as the camera scene: this section is display:none until
     the loader reveals it, so the canvas may measure zero right now. Watching
     the element catches the real size whenever it lands. */
  // Resizing clears the drawing buffer, so anything that resizes must repaint.
  const handleResize = () => {
    resize();
    if (!running && stripW > 0) {
      items.forEach(place);
      renderer.render(scene, camera);
    }
  };

  const sizeWatcher = new ResizeObserver(handleResize);
  sizeWatcher.observe(canvas);

  window.addEventListener("resize", handleResize, { passive: true });

  resize();
  canvas.style.cursor = "grab";

  // Paint one frame straight away so the canvas is never blank while we wait
  // for the visibility observer to start the loop.
  offset = target = readScroll();
  items.forEach(place);
  renderer.render(scene, camera);

  return {
    /* Force a repaint — useful when something else moves the strip. */
    render() { renderer.render(scene, camera); },

    destroy() {
      disposed = true;
      running = false;
      visibility.disconnect();
      sizeWatcher.disconnect();
      window.removeEventListener("resize", handleResize);
      items.forEach(m => { m.material.uniforms.uTex.value.dispose(); m.material.dispose(); });
      geometry.dispose();
      renderer.dispose();
    }
  };
}
