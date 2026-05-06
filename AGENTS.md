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
- Default layout for all pages is `"default"` (set globally in `_config.yml`); home page uses `layout: home`.

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
_sass/                # custom CSS overrides
_site/                # BUILD OUTPUT — gitignored, never edit
_tools/               # convenience shell scripts
assets/               # static assets (favicon, images)
```

---

## Toolchain Quirks (do not change without reason)

- `jekyll-sass-converter ~> 3.1.0` is pinned to fix a sass compatibility issue with `just-the-docs` (upstream issue #1607). Do not update carelessly.
- `sass.quiet_deps: true` and `sass.silence_deprecations: ['import']` in `_config.yml` suppress known theme deprecation warnings (#1541, #1607). Do not remove them.
- Ruby 3.4 is used in CI. No `.ruby-version` file exists; use 3.4 locally.

---

## CI

| Workflow    | Trigger                               | What it does                      |
| ----------- | ------------------------------------- | --------------------------------- |
| `ci.yml`    | PRs to `gh-pages`                     | Runs `jekyll build` as smoke test |
| `pages.yml` | Push to `gh-pages` or manual dispatch | Build + deploy to GitHub Pages    |
