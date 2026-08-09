/* ============================================================
   thadtakesphotos.com

   Deliberately small. The gallery, the pricing tables and every
   piece of copy are server-rendered HTML — nothing here builds
   page content, so the site reads correctly with JavaScript off.
   This file only adds behaviour on top of markup that already
   works: the contact form, and the footer year.
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);

/* ── Footer year ─────────────────────────────────────────── */
const year = $("#year");
if (year) year.textContent = new Date().getFullYear();

/* ── Contact form ────────────────────────────────────────────
   Posts in the background so the page never navigates away. With
   JavaScript disabled the form still submits normally to the same
   endpoint — the action and method are on the element itself.
------------------------------------------------------------ */
const form = $("#contact-form");

if (form) {
  const status = $("#form-status");

  /* Preselect the enquiry type from ?option=... so the pricing CTAs
     arrive with the right choice already made. Unknown or missing
     values leave the select on its blank default, which is valid. */
  const wanted = new URLSearchParams(location.search).get("option");
  const select = $("#option", form);
  if (wanted && select) {
    const match = [...select.options].some(o => o.value === wanted);
    if (match) select.value = wanted;
  }

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
    } catch {
      status.className = "form__status is-err";
      status.textContent = "That didn't send. Please try again, or reach me on Instagram.";
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });
}
