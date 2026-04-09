# Changelog

All notable changes to the **Knowledge as Code** template and pattern definition.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The pattern itself is
versioned alongside the reference template — `v1.0` of the template implements `v1.0` of the
pattern.

> **Concept inception: 2026-01-20.** Sam Rogers first published the Knowledge as Code concept on
> [snapsynapse.com](https://snapsynapse.com/insights/knowledge-as-code/) after confirming prior-art
> checks. Code followed two months later.

## [Unreleased]

_Nothing yet._

## [1.0.0] — 2026-04-09

The 1.0 release. Consolidates the repo into a single-branch layout where the landing page, the
generated reference demo, and the raw source markdown all live at the same domain. Ships the
canonical pattern definition at <https://knowledge-as-code.com/>.

### Added
- **Canonical landing page** at `knowledge-as-code.com/` — hand-written `index.html` covering
  what the pattern is, why it matters, a reference implementation (AITool.watch), a "see the
  pattern in action" split between the built demo and the raw markdown source, three production
  "built with" cards, and a four-step getting-started guide.
- **`/demo/`** — the generated reference site built from the example data, served at
  `knowledge-as-code.com/demo/` so visitors can see the pattern in action without cloning.
- **Raw source served at the same domain** — `data/examples/*.md` and `project.yml` now serve as
  `text/markdown` and `text/yaml` directly from `knowledge-as-code.com`, enabling the landing's
  "left column is input, right column is output, same URL" demonstration.
- **`.nojekyll` at repo root** to prevent GitHub Pages from processing markdown files, so raw
  `.md` sources serve as text.
- **JSON-LD structured data** (`TechArticle` + `DefinedTerm` + `Organization`) staking the term
  and grounding E-E-A-T signals.
- **Dated byline + `v1.0` version badge + CC-BY-4.0 license link** visible in the landing hero.
- **`sitemap.xml`, `robots.txt`, `404.html`, `/imgs/og.png`** at repo root — full SEO surface.
- **Open Graph + Twitter card metadata** for social sharing.
- **"Built with Knowledge as Code" section** featuring three production sites: aitool.watch,
  everyailaw.com, and meetings.snapsynapse.com.
- **Self-healing verification** — `.github/workflows/verify.yml` now opens a GitHub issue when
  `verify.js` detects stale or missing entities, or comments on the existing open drift issue to
  prevent duplicate alerts across weekly runs. Includes an auto-created `knowledge-drift` label.
- **IDE-style brand mark** — `{knowledge-as-code}` in Courier with syntax-highlighted braces
  (amber), identifiers (emerald), and hyphens (muted).
- **`KAC_OUTPUT_DIR` and `KAC_SITE_URL` env-var overrides** in `build.js` for repos that need to
  build the same project at a different path or URL (used by this repo to build `/demo/`).
- **GitHub repo metadata**: 15 topics (up from 3) and an updated description emphasizing
  self-healing, agent-accessible, and zero-dependency traits.

### Changed
- **Deployment model** — GitHub Pages now serves from `main` branch root instead of an
  auto-generated `gh-pages` branch. Pushing to `main` is the deploy. No more `peaceiris/actions-gh-pages`
  step; no more hidden build-artifact branch.
- **Workflow (`build.yml`)** — renamed to `CI`, runs `validate.js` and `build.js` as sanity
  checks on push/PR with no deploy step. Permissions reduced to `contents: read`.
- **`project.yml`** — fixed trailing-slash handling on `url` so concatenated canonical URLs
  resolve correctly (`https://example.com/foo` instead of `https://example.comfoo`).
- **Repo description** updated to *"A template for building structured, self-healing,
  agent-accessible knowledge bases. Zero dependencies. Git-native. Ontology-driven. Multi-output."*

### Removed
- **`gh-pages` branch** — deleted on 2026-04-09 after the `main`-branch deploy was verified end-to-end.
- **`/docs/` folder** — tracked static assets (CSS, JS, 404, CNAME, `.nojekyll`) moved to
  repo root or `/demo/` as appropriate. The folder is no longer referenced by the workflow or Pages.
- **`/site/` folder** — an earlier blue-themed landing draft that was never wired into deployment.
  Removed.
- **Orphan `/index.html` + `/sitemap.xml` + `/robots.txt` at repo root** (from a brief earlier
  iteration) — now properly integrated.

### Fixed
- **Custom domain `knowledge-as-code.com`** — configured for the first time. GitHub Pages custom
  domain set, DNS verified (four apex A records to `185.199.108-111.153` + `www` CNAME to
  `snapsynapse.github.io`), HTTPS certificate provisioned and enforced through 2026-06-24. A
  ghost claim on the domain (held by a previous GreenGeeks parking) was released as part of
  the release process.

## [0.4.0] — 2026-04-06

### Added
- Sortable tables in the generated site.
- `llms.txt`, `agents.json`, and RSS feed at `/index.xml` for machine discovery.
- `GitHub Sponsors` link in `SPONSORS.md`.
- `noindex` on thin bridge pages to improve SEO signal density.

### Fixed
- Upstream/downstream entity navigation in the generated reference pages.

## [0.3.0] — 2026-04-03

### Added
- Public template scaffolding — `README`, `CONTRIBUTING`, `LICENSE`, `ATTRIBUTION`.

### Changed
- **Ownership transferred from Snap Synapse to PAICE.work PBC.** All new attribution and
  copyright lines point to PAICE.work PBC. The GitHub org name remains `snapsynapse` (repo URL
  unchanged).
- Live example URLs in the README updated to reflect the three production deployments.

## [0.2.0] — 2026-03-27

### Added
- `scripts/verify.js` — freshness / staleness checking based on `last_verified` frontmatter.
- `mcp-server.js` — Model Context Protocol server exposing the knowledge base as agent tools
  dynamically generated from `project.yml` entity configuration.
- `VERIFICATION.md` contributor documentation.
- Open Graph image for social sharing.

## [0.1.0] — 2026-03-25

### Added
- Initial template scaffolding: `project.yml` ontology config, `scripts/build.js` config-driven
  site generator, `scripts/validate.js` cross-reference linter, example data for ISO 27001 and
  NIST CSF, dark/light themed static site output, JSON API, bridge pages, `CNAME` fixture.

[Unreleased]: https://github.com/snapsynapse/knowledge-as-code-template/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/snapsynapse/knowledge-as-code-template/releases/tag/v1.0.0
[0.4.0]: https://github.com/snapsynapse/knowledge-as-code-template/releases/tag/v0.4.0
[0.3.0]: https://github.com/snapsynapse/knowledge-as-code-template/releases/tag/v0.3.0
[0.2.0]: https://github.com/snapsynapse/knowledge-as-code-template/releases/tag/v0.2.0
[0.1.0]: https://github.com/snapsynapse/knowledge-as-code-template/releases/tag/v0.1.0
