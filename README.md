# Knowledge-as-Code Template

A template for building structured, version-controlled knowledge bases with an ontology-first approach. Edit a config file, add markdown data, get a full HTML site + JSON API.

**[Knowledge as Code](https://knowledge-as-code.com)** is a pattern created by [Sam Rogers](https://sam-rogers.com) at [Snap Synapse](https://snapsynapse.com). It applies software engineering practices to knowledge management: plain text, Git-native, zero-dependency, ontology-driven, multi-output from a single source.

## Live Examples

- [AI Capability Reference](https://airef.snapsynapse.com) — AI model capabilities across 12 products
- [AI Regulation Tracker](https://aireg.snapsynapse.com) — global AI regulatory landscape
- [Meeting Standards Reference](https://meetings.snapsynapse.com) — meeting facilitation standards

## Quick Start

1. **Use this template** — click "Use this template" on GitHub, or clone locally
2. **Edit `project.yml`** — define your domain entities, groups, colors, and site identity
3. **Add data** — create markdown files in `data/` following the schema in `data/_schema.md`
4. **Build** — `node scripts/build.js`
5. **Deploy** — push to GitHub, Pages deploys automatically

## What You Get

- **Static HTML site** — homepage, list pages, detail pages, coverage matrix, timeline, comparison tool
- **JSON API** — programmatic access at `docs/api/v1/`
- **Bridge pages** — SEO-targeted pages like "Does X require Y?"
- **Dark/light theme** — with persistence
- **Client-side search** — lazy-loaded, keyboard-navigable
- **Zero dependencies** — Node.js built-ins only

## Project Structure

```
project.yml          # Domain configuration (edit this first)
data/
  examples/          # Example data (replace with your own)
    primary/         # Stable anchor entities (e.g., requirements, obligations)
    container/       # Grouping entities (e.g., frameworks, regulations)
    authority/       # Source entities (e.g., organizations, regulators)
    mapping/         # index.yml connecting containers to primaries
scripts/
  build.js           # Config-driven site generator
  validate.js        # Cross-reference validator
docs/                # Generated output (do not edit)
```

## The Ontology

Every knowledge-as-code project has four entity roles:

```
Authority → Container → Provision → Primary
```

| Role | What it is | Example domains |
|------|-----------|----------------|
| **Primary** | Stable anchors that don't change when sources change | Requirements, Obligations, Capabilities, Controls |
| **Container** | Grouping entities that contain provisions | Regulations, Frameworks, Products, Standards |
| **Authority** | Source entities that produce containers | Regulators, Vendors, Standards bodies |
| **Secondary** | Mapping entities connecting containers to primaries | Provisions, Implementations, Mappings |

Primaries are stable; containers are unstable. When a framework is amended, its provisions change, but the underlying requirements persist.

## Configuration

All domain-specific settings live in `project.yml`:

- **Entity names** — what to call each entity type (e.g., "Requirement" vs "Obligation")
- **Groups** — categories for primary entities, with dark/light mode colors
- **Statuses** — lifecycle states for containers, with colors
- **Navigation** — site nav items
- **Bridge pages** — which SEO pages to generate
- **Theme** — accent colors

## Commands

```bash
node scripts/build.js      # Build the site
node scripts/validate.js   # Validate cross-references
```

## Architecture

- **File-over-App** — data in markdown files, not a database
- **Zero dependencies** — no npm install, no supply chain risk
- **Bespoke static generation** — the build script _is_ the specification
- **GitOps** — Git is the single source of truth

## The Pattern

Knowledge as Code has six defining properties:

1. **Plain text canonical** — knowledge in human-readable, version-controlled files
2. **Self-healing** — automated verification detects when knowledge drifts from reality
3. **Multi-output** — one source produces every format needed (HTML, JSON API, MCP, SEO pages)
4. **Zero-dependency** — no external packages; nothing breaks when you come back in a year
5. **Git-native** — Git is the collaboration layer, audit trail, and deployment trigger
6. **Ontology-driven** — a vendor-neutral taxonomy maps to domain-specific implementations

Read the full pattern definition at [knowledge-as-code.com](https://knowledge-as-code.com).

## Attribution

Knowledge as Code was created by [Sam Rogers](https://sam-rogers.com) / [Snap Synapse](https://snapsynapse.com). See [ATTRIBUTION.md](ATTRIBUTION.md) for details.

## License

MIT
