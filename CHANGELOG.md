# Changelog

All notable changes to the **Knowledge as Code** template and pattern definition.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The pattern itself is
versioned alongside the reference template — `v1.0` of the template implements `v1.0` of the
pattern.

> **Concept inception: 2026-01-20.** Sam Rogers first published this Knowledge-as-Code implementation
> on [snapsynapse.com](https://snapsynapse.com/tools/knowledge-as-code/) after an initial prior-art
> review. A later review found earlier uses of both the term and the underlying repository-based
> practice. This project no longer claims to have originated the broader category.

## [Unreleased]

### Changed
- Repositioned the project as an internal-first open reference generator for evidence-backed structured sites.
- Replaced unqualified self-healing claims with the deterministic drift checks the repository actually ships.
- Distinguished maintainer-operated implementations from independent external adoption.
- Standardized onboarding on the clean-project initializer and added a Pages deployment workflow for generated repositories.
- Corrected the canonical Snap Synapse writeup path and acknowledged established prior art.
- Added a zero-dependency guided initializer that creates a clean project with only the engine, worked example, MCP runtime, and deployment workflows.
- Made `docs/` transient local output in the canonical repository; `demo/` is now the only tracked generated build.
- Expanded deterministic verification to fail on missing reviews, invalid or future dates, mapping gaps, and required evidence metadata.
- Added a provider-independent external verifier contract using an explicit executable and JSONL input/output, with no shell or source-file mutation.
- Re-verified the worked example against current ISO and NIST primary sources, corrected unsupported claims, and replaced the ambiguous data-quality mapping with information integrity.

## [1.0.2] — 2026-06-12

### Added
- Added eval coverage for unsafe output directories, stale generated-output cleanup, unsafe entity IDs, status badge contrast, generated URL path stability, and JSON-RPC notification silence.
- Documented slug-safe entity IDs, generated-output cleanup behavior, and MCP notification semantics across human docs and agent-facing guides.

### Changed
- Bumped the GuideCheck assistant guide to `1.0.1` with repository-specific generated-output and slug-ID constraints.
- Regenerated tracked `docs/` and `demo/` outputs after status badge contrast hardening.

### Fixed
- Refused unsafe build output directories before cleanup and removed stale files only under generator-owned output paths.
- Rejected unsafe filenames, mapping IDs, and mapping references during validation and build.
- Encoded generated URL path segments after strict ID validation.
- Computed status badge foreground colors from background luminance instead of hard-coding theme text colors.
- Stopped returning JSON-RPC errors for notifications that omit `id`.
- Refreshed content-provenance hashes after intentional README, guide, and tooling updates.
- Made `scripts/build.js` output reproducible by sourcing generated-output timestamps (`meta.generated`, `agents.json` `last_updated`, sitemap `lastmod`, RSS `lastBuildDate`) from the freshest date in the data rather than wall-clock time. The "generated outputs are current" CI gate could never pass before, because each rebuild stamped a new `new Date()` into committed artifacts.

## [1.0.1] — 2026-05-30

### Added
- Added eval coverage for manifest hash freshness, changelog release-tag consistency, and generated-output injection boundaries.
- Documented generated-output safety behavior for external URLs, CSS tokens, table parsing, and client-side comparison labels.
- Adopted the GuideCheck Human-Verifiable Assistant Guide profile at Level 4 with `assistant-guide.txt`, a well-known canonical guide, a sidecar manifest, and discovery links.

### Changed
- Normalized example and public-facing URLs to `https` bare-domain form.

### Fixed
- Restricted generated navigation hrefs to safe internal paths before HTML emission.
- Normalized coverage-badge group classes on generated container detail pages before HTML emission.
- Refreshed the README content-provenance hash after the intentional schema documentation update.
- Escaped generated compare-page labels and script data before client-side HTML insertion.
- Validated generated CSS class names and color values before writing inline styles.
- Restricted generated external links to `https` and normalized `www` hostnames to bare domains.
- Preserved empty markdown table cells during parsing.
- Parsed quoted empty YAML scalars as empty strings instead of objects.

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
  everyailaw.com, and VirtualClassroom.watch.
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

[Unreleased]: https://github.com/snapsynapse/knowledge-as-code-template/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/snapsynapse/knowledge-as-code-template/releases/tag/v1.0.2
[1.0.1]: https://github.com/snapsynapse/knowledge-as-code-template/releases/tag/v1.0.1
[1.0.0]: https://github.com/snapsynapse/knowledge-as-code-template/releases/tag/v1.0.0
[0.4.0]: https://github.com/snapsynapse/knowledge-as-code-template/releases/tag/v0.4.0
[0.3.0]: https://github.com/snapsynapse/knowledge-as-code-template/releases/tag/v0.3.0
[0.2.0]: https://github.com/snapsynapse/knowledge-as-code-template/releases/tag/v0.2.0
[0.1.0]: https://github.com/snapsynapse/knowledge-as-code-template/releases/tag/v0.1.0
