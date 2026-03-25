# Knowledge-as-Code Template

A template for building structured, version-controlled knowledge bases with an ontology-first approach. Edit a config file, add markdown data, get a full HTML site + JSON API.

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

## License

MIT
