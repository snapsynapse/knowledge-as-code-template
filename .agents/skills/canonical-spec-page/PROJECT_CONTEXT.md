# PROJECT_CONTEXT.md — Knowledge as Code

Pre-filled context for the `canonical-spec-page` skill. When the skill runs against
this repo, it reads this file during Phase 0 and skips any questions whose answers
it finds here.

**Note:** this repo's landing was built in a hand-derived session on 2026-04-09 that
did not invoke the skill. This file was written after the fact so future sessions
don't re-derive these answers. If you rerun the skill in `mode: enhance`, most of
the enhancements will already be present and the skill will no-op most checklist
items — that's fine.

```yaml
# Identity
project_name: Knowledge as Code
canonical_url: https://knowledge-as-code.com/
repo_slug: snapsynapse/knowledge-as-code-template

# Hero
tagline: An open pattern for durable, self-healing knowledge bases
hero_h1: Knowledge as Code
hero_subtitle: >
  Plain-text canonical. Self-healing. Multi-output. Zero-dependency.
  Git-native. Ontology-driven.
hero_hook: >
  Knowledge as Code applies software engineering practices to knowledge
  management. Plain-text canonical files, automated verification, and a
  single source that produces HTML, JSON APIs, and MCP servers — with no
  database, no vendor, and no silent decay.

# SEO
keywords:
  - knowledge as code
  - knowledge management
  - documentation
  - git-native
  - ontology
  - self-healing docs
  - JSON API
  - MCP server
  - static site
  - plain text
  - version control
  - open pattern

# Authorship
author_name: Sam Rogers
author_url: https://paice.work/
publisher_name: PAICE.work PBC
publisher_url: https://paice.work/
twitter_handle: "@snapsynapse"

# Dates — BOTH confirmed with the owner during the 2026-04-09 session
date_published: "2026-01-20"   # First publication on snapsynapse.com/insights
date_modified: "2026-04-09"    # Landing site v1.0 launch

# Versioning
version: v1.0
canonical_file: index.html     # landing is the canonical reference; spec is inline

# Theme
theme_accent: "#059669"        # emerald
highlight_accent: "#eab308"    # amber (used for braces in brand wordmark + punctuation)
dark_mode_default: true

# Publish layout — CRITICAL for this repo
# This repo uses `.` (root-served) because it's dual-purpose:
# - `/index.html` = the KaC landing page (this file)
# - `/demo/` = the template's generated reference site (see dual-purpose notes)
# - `/data/examples/*.md` = raw source markdown served as text/markdown
# - `.nojekyll` at root lets raw .md and .yml files pass through
publish_root: "."

# Mode
# This repo's landing was hand-derived in the 2026-04-09 session. The first
# canonical-spec-page invocation will find most enhancements already in place.
# Run it as `mode: enhance` (not generate) so it doesn't overwrite index.html.
mode: enhance

# Dual-purpose repo — see references/dual-purpose-repos.md (if added in future
# skill version) for the env-var override pattern used here.
dual_purpose:
  also_serves_as: template
  template_output_default: "docs/"        # what build.js writes in a fork
  landing_repo_output: "demo/"            # what build.js writes here
  build_env_overrides:
    KAC_OUTPUT_DIR: "demo"                # redirects build.js output
    KAC_SITE_URL: "https://knowledge-as-code.com/demo/"  # overrides config.url

# JSON-LD relationships
defined_term_alternate_names:
  - KaC
  - knowledge-as-code
defined_term_description: >
  An open pattern that applies software engineering practices to knowledge
  management. Characterized by six properties: plain-text canonical,
  self-healing, multi-output, zero-dependency, Git-native, and ontology-driven.
citations:
  - { name: "AI Tool Watch — reference implementation", url: "https://aitool.watch/" }
  - { name: "Graceful Boundaries", url: "https://gracefulboundaries.dev/" }
  - { name: "Skill Provenance",    url: "https://skillprovenance.dev/" }
  - { name: "Original long-form writeup", url: "https://snapsynapse.com/insights/knowledge-as-code/" }
same_as:
  - https://github.com/snapsynapse/knowledge-as-code-template
  - https://snapsynapse.com/insights/knowledge-as-code/

# Canonical reference note
cross_post_targets:
  # Not yet cross-posted. Candidates tracked in LocalBrain hub note under
  # #kac-template follow-up tasks:
  - { name: "Dev.to", url: "" }           # canonical_url supported in frontmatter
  - { name: "LinkedIn post", url: "" }    # long-form post, not Article
  - { name: "Medium", url: "" }           # Import-a-story auto-sets canonical
  - { name: "Show HN", url: "" }          # already queued in marketing notes

# Secondary demo — used heavily here
secondary_demo:
  path: /demo/
  label: See the built demo
  source_html: demo/index.html            # already exists, built by build.js
  label_description: >
    The generated reference site (ISO 27001 / NIST CSF) produced by the
    template's build.js from the example markdown in data/examples/.

# OG image
og_image_source: imgs/og.png              # already at /imgs/og.png

# Logo concept — IDE-style wordmark
# This is a logo *category* the canonical-spec-page skill doesn't document yet.
# Worth back-porting to references/logo-design.md.
logo_concept: |
  IDE-style wordmark. "{knowledge-as-code}" rendered in Courier monospace
  with syntax-highlight colouring:
    - Curly braces    { }      amber  (var(--highlight))
    - Identifiers     knowledge, as, code   emerald (var(--accent))
    - Hyphen          -        muted gray (var(--muted))
  Bold weight (700), 14px. Evokes a code snippet in a text editor, reinforcing
  the "treat knowledge like code" thesis at first glance. See index.html .brand
  class for implementation.

# Novel content patterns this repo introduced (worth back-porting to
# references/content-structure.md — see skill follow-ups):
introduced_patterns:
  - name: "See the pattern in action"
    what: >
      A 2-column split section. Left card = link to the built demo. Right card =
      list of links to raw .md source files on the same domain. Each click lets
      a visitor see "input → output" at the same URL. Requires .nojekyll and
      root-served publish_root.
    css_class: .split + .card.primary-card
  - name: "Built with Knowledge as Code"
    what: >
      Production social proof row. Three cards, each showing a real adopter site.
      Uses the adopter's own og:image as the card thumbnail where available;
      falls back to a stat-forward text card for sites without og:image.
    css_class: .used-by-grid + .used-by-card
  - name: "Canonical reference aside"
    what: >
      Small callout under the 'See in action' section declaring this URL as
      canonical and pointing to commits/main/index.html for revision history.
    css_class: .canonical-note
```

## Notes for the skill

- **Do not overwrite `/index.html`** on an enhance-mode run. The current page is
  hand-derived with substance the skill can't regenerate (the "See the pattern in
  action" split, the "Built with" production cards, the IDE-style brand). Only
  fill missing checklist items.
- The `/demo/` folder is committed output of `build.js` run with `KAC_OUTPUT_DIR=demo`
  and `KAC_SITE_URL="https://knowledge-as-code.com/demo/"`. To refresh the demo:
  ```bash
  rm -rf demo && mkdir -p demo/assets
  cp docs/assets/{styles.css,search.js,tables.js} demo/assets/ 2>/dev/null || true
  KAC_OUTPUT_DIR=demo KAC_SITE_URL="https://knowledge-as-code.com/demo/" node scripts/build.js
  ```
- The `verify.yml` workflow already opens GitHub issues on drift (self-healing
  wiring). Do not duplicate.
- This repo has a live `CHANGELOG.md` at root with Keep-a-Changelog format,
  tracking v0.1.0 through v1.0.0 and beyond. The first canonical-spec-page run
  that adds a CHANGELOG.md anywhere should cross-reference this file as the
  model.
- The LocalBrain hub note (`8_Reference/Hub Notes/Knowledge as Code Template HQ.md`)
  has a "Repo Architecture" section with full layout documentation and a
  "Follow-ups" section with ~10 open tasks tagged `#kac-template`. Read it during
  Phase 0 LocalBrain pre-flight.
