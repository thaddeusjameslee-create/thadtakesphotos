# Photos

Drop your image files into **`public/photos/`**.

This guide lives outside `public/` on purpose — anything inside that folder gets
served on the live site, and notes to yourself shouldn't be.

Filenames the site is looking for:

| File | Where it shows up |
|------|-------------------|
| `hero.jpg` | Full-screen background image at the very top. Use a wide, horizontal shot with empty space on the **left** — the headline sits there. |
| `about.jpg` | Vertical photo of you in the About section (4:5 works best). |
| `og.jpg` | The thumbnail that appears when someone texts or posts the link. 1200×630, horizontal. |
| `01.jpg`, `02.jpg`, … | The gallery. As many as you list in `PHOTOS`. |
| `portrait-01.jpg` … `portrait-03.jpg` | The three panels orbiting the camera near the top. **Vertical crops** — they're shown at roughly 5:7, so a landscape shot gets cut badly. Right now they're generated placeholders; drop real files at these names and they appear with no code change. |

**Currently placeholders.** `01`–`04` and the hero are landscape test shots, not
senior portraits, and the three orbiting panels are generated stand-ins.
Replace them whenever real sessions come in — same filenames works fine, or use
new names and update the list in `public/js/main.js`.

Those three orbiting portraits are the first real photographs anyone sees on
the site, so they're worth picking carefully.

Nothing breaks if a file is missing — you just get a warm gradient placeholder
instead. Add them whenever you're ready.

## Before you upload

Export at **2000px on the long edge, JPEG quality 80**. Straight-off-the-camera
files are 8–15 MB each and will make the site crawl on a phone. 2000px still
looks sharp on a laptop and lands around 400 KB.

Better still, save as `.webp` — roughly 30% smaller at the same quality. If you
do, update the file extensions in `js/main.js`.

## Adding or reordering gallery photos

Open `public/js/main.js` and edit the `PHOTOS` list at the top. Each line is one photo.
The `tag` controls which filter button it appears under, and the order in that
list is the order on the page.
