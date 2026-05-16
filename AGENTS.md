# Knowledge-as-Code Project

A config-driven knowledge base using an ontology-first approach. All domain-specific settings are in `project.yml`.

## This repo is two things at once

This repo is BOTH the reference template (MIT, fork-friendly) AND the canonical landing site for the Knowledge-as-Code pattern at **knowledge-as-code.com**. That dual role shapes the file layout:

- `/index.html` + `/.nojekyll` + `/CNAME` + `/404.html` + `/sitemap.xml` + `/robots.txt` + `/imgs/` — the **landing site** (hand-written, served at the root of knowledge-as-code.com)
- `/demo/` — the **built reference site** (generated from the example data; served at knowledge-as-code.com/demo/)
- `/data/examples/` — the **source markdown** that produces `/demo/` (also served raw at knowledge-as-code.com/data/examples/…)
- `/project.yml`, `/scripts/`, etc. — the template internals

GitHub Pages serves `main` branch root. `.nojekyll` is critical so raw `.md` files serve as text for the "see the source" links on the landing.

**Template forks only need `/scripts/`, `/project.yml`, `/data/`, and the workflow.** They can delete `/index.html`, `/demo/`, `/404.html`, `/CNAME`, `/imgs/`, `/sitemap.xml`, `/robots.txt`, and `/.nojekyll` to start clean.

## Project Structure

```
project.yml           # Domain configuration (THE key file)
data/
  examples/           # Data files (one .md per entity)
    requirements/     # Stable anchor entities (primary)
    frameworks/       # Grouping entities with provisions (container)
    organizations/    # Source entities (authority)
    mapping/          # index.yml connecting containers to primaries
scripts/
  build.js            # Config-driven site generator
  validate.js         # Cross-reference validator
demo/                 # Generated reference site (this repo only — forks use docs/)
  api/v1/             # Static JSON API
```

## Key Commands

```bash
# Template-default build (writes to ./docs/)
node scripts/build.js

# This repo's build (writes to ./demo/ with the real site URL)
KAC_OUTPUT_DIR=demo KAC_SITE_URL="https://knowledge-as-code.com/demo/" node scripts/build.js

# Validate cross-references
node scripts/validate.js

# Check entity freshness / staleness
node scripts/verify.js
```

`KAC_OUTPUT_DIR` and `KAC_SITE_URL` are env-var overrides added for this repo's split landing-plus-demo layout. Template forks don't need them.

## Entity Model

The ontology is defined in `project.yml` under `entities:`. Four roles:

| Role | Config key | Description |
|------|-----------|-------------|
| Primary | `entities.primary` | Stable anchors (e.g., requirements) |
| Container | `entities.container` | Grouping entities (e.g., frameworks) |
| Authority | `entities.authority` | Source entities (e.g., organizations) |
| Secondary | `entities.secondary` | Mapping entities connecting containers to primaries |

Relationship: Authority → Container → Secondary → Primary

## Adding Data

See `data/_schema.md` for the full file format reference.

1. Create a `.md` file in the appropriate `data/examples/` directory
2. Add YAML frontmatter with required fields per the schema
3. For containers: add timeline table and provision sections separated by `---`
4. Add mapping entries to `data/examples/mapping/index.yml`
5. Run `npm run validate` to check cross-references
6. Run `npm run build` to generate the site

## Customization

Edit `project.yml` to change:
- Entity names and directories
- Group categories and colors
- Status types and colors
- Site name, URL, and navigation
- Bridge page patterns
- Theme accent colors
