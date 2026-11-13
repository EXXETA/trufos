# AGENTS.md

This repo is the **Jekyll documentation site** for [Trufos](https://github.com/EXXETA/trufos), an Electron-based REST client. It is not the application source code.

Published to: `https://exxeta.github.io/trufos`  
Primary branch: **`gh-pages`** (not `main`) — PRs and CI target this branch.

---

## Setup & Commands

```bash
bundle install              # install dependencies (or: _tools/setup.sh)
bundle exec jekyll serve    # local dev server (or: _tools/start.sh)
bundle exec jekyll build    # production build → _site/
```

There is no test suite, linter, or typecheck step. A successful `bundle exec jekyll build` is the only verification.

**`_config.yml` is not hot-reloaded** — restart the server after any change to it.

---

## Local Dev Gotcha: baseurl

`_config.yml` sets `baseurl: "/trufos"`, which breaks asset paths when serving locally without adjustment. Use:

```bash
bundle exec jekyll serve --baseurl ""
```

CI overrides this dynamically via the `configure-pages` GitHub Action.

---

## Content Conventions

- All pages require Jekyll front matter with `title:` and `nav_order:`.
- Child pages must include `parent: <Parent Title>` matching the parent's `title:` exactly (case-sensitive).
- Section index pages use `has_children: true`.
- Use `{% link path/to/file.md %}` for cross-page links — do not use raw relative paths.
- Default layout for all pages is `"default"` (set globally in `_config.yml`); home page uses `layout: home`. Its hero, screenshots and feature grid come from the front matter of `index.md` (format documented at the top of `_layouts/home.html`).
- Link images and assets with `{{ '/assets/…' | relative_url }}`, never `../../assets/…` (breaks under the `/trufos` baseurl). Inside `{% raw %}` blocks Liquid does not run: use a reference-style link (`![Alt][ref]`) and put `[ref]: {{ '/assets/…' | relative_url }}` after `{% endraw %}` (see `documentation/user-guide/variables.md`).

---

## Screenshots

Images are committed already converted; the build does not resize anything. CI fails on any image over 250 KB in `assets/` or `documentation/`.

1. Put raw screenshots (PNG/JPG) in `_screenshots/` (gitignored), using subfolders as you like. Name theme variants `<name>-light.png` and `<name>-dark.png`.
2. `npm install --prefix _tools` (once; installs sharp)
3. `node _tools/optimize-screenshots.mjs` — writes 1600px-wide WebP files to `assets/images/screenshots/` (same subfolders) and prints front matter with width and height. Options: `--width`, `--quality`, or paths inside `_screenshots/` to convert only those.
4. Commit the `.webp` files, not the originals. Always set `width` and `height` on `<img>` tags.

Take screenshots of both themes; the home layout shows the matching one via the `.only-light` / `.only-dark` classes.

---

## Directory Layout

```
documentation/        # all content pages (Markdown)
  architecture/
  development/
  services/
  ui-components/
  user-guide/
_includes/            # Jekyll HTML includes / theme overrides
_layouts/             # layout overrides (home.html = landing page)
_sass/
  color_schemes/      # trufos-light / trufos-dark, derived from the app's tokens
  custom/             # setup.scss (font, radius) and custom.scss (all custom styles)
_screenshots/         # raw screenshots — gitignored, see "Screenshots"
_site/                # BUILD OUTPUT — gitignored, never edit
_tools/               # convenience scripts (shell + optimize-screenshots.mjs)
assets/               # static assets (favicon, fonts, images, JS)
```

---

## Theming

- Colours live in `_sass/color_schemes/trufos-{light,dark}.scss`, taken from `src/renderer/styles/index.css` on `main`. Change them there, not in `custom.scss`.
- `custom.scss` is compiled once per scheme, so it uses the `$trufos-*` SCSS variables directly; they are also exposed as `--trufos-*` CSS custom properties for JS-rendered markup.
- `color_scheme: trufos-light` makes the theme's `just-the-docs-default.css` the light scheme. Dark mode swaps it for `just-the-docs-trufos-dark.css` via `assets/js/dark-mode-service.js`; the inline script in `_includes/head_custom.html` loads the dark sheet before first paint. The theme is stored only when the visitor clicks the toggle; otherwise the OS setting applies.
- Lato is self-hosted in `assets/fonts/lato/` (no third-party font requests).
- Light-mode text colours must reach 4.5:1 contrast on both `#ffffff` and the `#f2f3f5` sidebar; that is why links use `#0073b3` instead of the app accent `#0098ed`.

---

## Toolchain Quirks (do not change without reason)

- `jekyll-sass-converter ~> 3.1.0` is pinned to fix a sass compatibility issue with `just-the-docs` (upstream issue #1607). Do not update carelessly.
- `sass.quiet_deps: true` and `sass.silence_deprecations: ['import']` in `_config.yml` suppress known theme deprecation warnings (#1541, #1607). Do not remove them.
- `just-the-docs` is pinned to `0.10.1` in the `Gemfile`. The custom colour schemes depend on its internals (e.g. 0.12.0 removed the `OneDarkJekyll` syntax theme that `trufos-dark.scss` imports). Rebuild and check both themes before bumping it.
- `Gemfile.lock` must list the `x86_64-linux-gnu` platform (CI runs on Linux). If a local `bundle update` drops it: `bundle lock --add-platform x86_64-linux-gnu`.
- Ruby 4.0 is used in CI. No `.ruby-version` file exists; use 4.0 locally.

---

## CI

| Workflow    | Trigger                               | What it does                      |
| ----------- | ------------------------------------- | --------------------------------- |
| `ci.yml`    | PRs to `gh-pages`                     | Checks image sizes (≤ 250 KB), runs `jekyll build` as smoke test |
| `pages.yml` | Push to `gh-pages` or manual dispatch | Build + deploy to GitHub Pages    |
