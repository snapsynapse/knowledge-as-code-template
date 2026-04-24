# Knowledge-as-Code Template

A template for building structured, version-controlled knowledge bases with an ontology-first approach. Edit a config file, add markdown data, get a full HTML site + JSON API.

**[Knowledge as Code](https://knowledge-as-code.com)** is a pattern created for [PAICE.work](https://paice.work/) PBC. It applies software engineering practices to knowledge management: plain text, Git-native, zero-dependency, ontology-driven, multi-output from a single source.

## What it produces

**[Live demo →](https://knowledge-as-code.com/demo/)** — the output of this template's example data, deployed on GitHub Pages. Includes a searchable HTML site, coverage matrix, timeline, comparison tool, and JSON API.

Built examples using this template:

- [AI Tool Watch](https://aitool.watch) — AI model capabilities across 12 products
- [Every AI Law](https://everyailaw.com) — global AI regulatory landscape
- [Meeting Standards Reference](https://meetings.snapsynapse.com) — meeting facilitation standards

## Quick Start

1. **Use this template** -- on GitHub, click the green "Use this template" button (not "Clone"). This creates a new repo with no git history and no upstream connection. Cloning is fine for local exploration but won't give you a clean starting repo.
2. **Edit `project.yml`** -- start with the entity names (`entities.primary.name`, `entities.container.name`, etc.) and groups. You can adjust colors and navigation later. Leave `url` until your GitHub repo is configured.
3. **Replace example data** -- delete the files in `data/examples/requirements/`, `data/examples/frameworks/`, `data/examples/organizations/`, and `data/examples/mapping/index.yml`, then add your own. See [Replacing example data](#replacing-example-data) and [`data/_schema.md`](data/_schema.md) for the format.
4. **Build** -- `node scripts/build.js`. A successful build prints `Build complete — N HTML pages, N JSON API files`. Check the `docs/` directory for the output, and open any HTML file in a browser to verify it looks right.
5. **Deploy** -- choose your Pages strategy. This repo validates builds in CI, but it does not auto-deploy template forks by default. If you want automated deployment, add a Pages publish step for your repo.

## Output Policy

This repository intentionally tracks generated output in both `docs/` and `demo/`.

- `docs/` is the template-default generated site output.
- `demo/` is the canonical reference build used for `https://knowledge-as-code.com/demo/`.
- Neither directory should be edited by hand. Regenerate them with `node scripts/build.js` or the `KAC_OUTPUT_DIR=demo KAC_SITE_URL="https://knowledge-as-code.com/demo/" node scripts/build.js` variant.

Template forks do not need to follow this policy. A fork can either:

- ignore `docs/` and publish via its own CI/deploy workflow, or
- commit `docs/` as a generated artifact if that matches its hosting model.

## What You Get

- **Static HTML site** — homepage, list pages, detail pages, coverage matrix, timeline, comparison tool
- **JSON API** — programmatic access at `docs/api/v1/`
- **Bridge pages** — SEO-targeted pages like "Does X require Y?"
- **Dark/light theme** — with persistence
- **Client-side search** — lazy-loaded, keyboard-navigable
- **Sortable tables** — click any column header to sort
- **MCP server** — AI agent access to your knowledge base
- **Discovery files** — llms.txt, agents.json, RSS for machine consumption
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

### How the pieces connect

```
project.yml                 data/examples/
(names, colors, config)     (one .md file per entity)
         \                         /
          \                       /
           +----> scripts/build.js <----+  data/examples/mapping/index.yml
                        |               (connects containers to primaries)
           +------------+------------+
           |            |            |
        docs/        docs/        docs/api/v1/
       (HTML site)  llms.txt       (JSON API)
       (sitemap)    agents.json    context.jsonld
```

You edit `project.yml` and `data/`. The build script reads both and writes everything under `docs/`. You never edit `docs/` directly.

### gist semantic layer

By default, every built site includes a semantic layer backed by [gist](https://semanticarts.com/gist/) — a minimalist upper ontology for the enterprise by Semantic Arts. This adds:

- `@type` annotations on every item in the JSON API (e.g. `"@type": "gist:KnowledgeConcept"`)
- `api/v1/context.jsonld` — a JSON-LD context file mapping KaC terms to gist IRIs
- `ontology` block in `api/v1/index.json` with the framework name, base IRI, and attribution

The default role-to-class mapping:

| KaC role | gist class |
|----------|-----------|
| primary | `gist:KnowledgeConcept` |
| container | `gist:Specification` |
| authority | `gist:Organization` |
| secondary | `gist:Commitment` |

Override any mapping in `project.yml` under `ontology.entities.<role>.gist_class`. To disable entirely:

```yaml
ontology:
  enabled: false
```

When enabled, CC BY 4.0 attribution to Semantic Arts is required on any published site. The attribution string is included automatically in `api/v1/index.json`.

## Configuration

All domain-specific settings live in `project.yml`:

- **Entity names** — what to call each entity type (e.g., "Requirement" vs "Obligation")
- **Groups** — categories for primary entities, with dark/light mode colors
- **Statuses** — lifecycle states for containers, with colors
- **Navigation** — site nav items
- **Bridge pages** — which SEO pages to generate
- **Theme** — accent colors

## Replacing example data

The template ships with example data in `data/examples/` (ISO 27001, NIST CSF). To replace it with your own domain:

1. **Update `project.yml`** -- rename entity types, groups, statuses, and colors to match your domain. The directory names under `entities.*.directory` control where the build script looks for files.

2. **Delete example files** -- remove the contents of `data/examples/requirements/`, `data/examples/frameworks/`, `data/examples/organizations/`, and `data/examples/mapping/index.yml`.

3. **Create your data files** -- add markdown files following the format documented in [`data/_schema.md`](data/_schema.md). Each entity type has specific frontmatter requirements and body structure.

4. **Update the mapping file** -- create entries in `data/examples/mapping/index.yml` that connect your containers to your primaries.

5. **Validate and build:**
   ```bash
   node scripts/validate.js   # Check cross-references
   node scripts/build.js      # Generate the site
   ```

For repo-level verification before opening a PR, prefer:

```bash
npm run eval
```

That runs the broader smoke/eval suite covering builds, links, API shape, parser fixtures, MCP smoke, and documentation consistency.

The build script looks for data in `data/examples/` first, then `data/`. You can rename `data/examples/` to `data/` if you prefer a flatter structure.

**What to keep:** Only `data/` contents and `project.yml` values need replacing. Do not delete `scripts/`, `.github/workflows/`, `mcp-server.js`, `mcp.json`, or `package.json` — these are the template engine and deployment config.

## Commands

```bash
node scripts/build.js      # Build the site (or: npm run build)
node scripts/validate.js   # Validate cross-references (or: npm run validate)
node scripts/verify.js     # Check entity freshness (or: npm run verify)
node scripts/eval.js       # Run smoke, link, API, parser, MCP, and docs evals (or: npm run eval)
```

## Architecture

- **File-over-App** — data in markdown files, not a database
- **Zero dependencies** — no npm install, no supply chain risk
- **Bespoke static generation** — the build script _is_ the specification
- **GitOps** — Git is the single source of truth

## AI Agent Support

Every Knowledge-as-Code site includes machine-readable discovery files:

- **MCP Server** -- `mcp-server.js` provides read-only access to all entities via Model Context Protocol
- **llms.txt** -- Generated at `docs/llms.txt` with entity model, API endpoints, and entity listings
- **agents.json** -- Machine-readable metadata at `docs/agents.json` for agent discovery
- **RSS feed** -- Recent updates at `docs/index.xml`
- **JSON API** -- Programmatic access at `docs/api/v1/`

### Using the MCP server

The MCP server exposes your knowledge base as tools that AI agents can call. Tool names are dynamically generated from your `project.yml` entity configuration.

**Add to Claude Code** (or any MCP-compatible client) via `mcp.json`:

```json
{
  "mcpServers": {
    "knowledge-base": {
      "command": "node",
      "args": ["mcp-server.js"],
      "description": "Read-only access to the knowledge base"
    }
  }
}
```

**Test it directly:**

```bash
node mcp-server.js
```

The server reads `project.yml` at startup and exposes tools for listing and retrieving each entity type. Tool names are derived from your entity config by lowercasing and replacing non-alphanumeric characters with hyphens:

| Config value | Tool name |
|-------------|-----------|
| `plural: Requirements` | `list_requirements` |
| `name: Requirement` | `get_requirement` |
| `plural: Frameworks` | `list_frameworks` |
| `name: Framework` | `get_framework` |
| `plural: Organizations` | `list_organizations` |
| `name: Organization` | `get_organization` |

Two fixed tools are always present regardless of config: `get_matrix` and `get_mappings`.

## Validation

`node scripts/validate.js` checks cross-references before building. Common errors and fixes:

| Error message | Cause | Fix |
|--------------|-------|-----|
| `Mapping "X" references unknown container "Y"` | `regulation` field in mapping doesn't match any container filename | Check the container file exists and the `regulation` value matches the filename (without `.md`) |
| `Mapping "X" references unknown primary "Y"` | `obligations` entry doesn't match any primary filename | Check the primary file exists and the ID matches |
| `Mapping "X" references unknown authority "Y"` | `authority` field doesn't match any authority filename | Check the authority file exists |
| `Container "X" references unknown authority "Y"` | `authority` frontmatter in container file doesn't match any authority | Create the authority file or correct the ID |
| `No data directory found` | Neither `data/examples/` nor `data/` exists | Check your data directory path and config |

## Verification

`node scripts/verify.js` detects stale entities and validates cross-reference completeness. A weekly GitHub Actions workflow runs it automatically and opens an issue on drift.

See [VERIFICATION.md](VERIFICATION.md) for the full guide: staleness thresholds, CI integration, and AI-assisted content review.

## Ecosystem

Knowledge as Code is part of a broader set of open standards:

- **[Graceful Boundaries](https://github.com/snapsynapse/graceful-boundaries)** — How services communicate operational limits to humans and agents
- **[Skill Provenance](https://github.com/snapsynapse/skill-provenance)** — Version identity that travels with agent skill bundles
- **[Siteline](https://siteline.to)** — AI agent readiness scanner for websites
- **[Knowledge as Code](https://knowledge-as-code.com)** — The pattern definition and community hub

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

Knowledge as Code is a [PAICE.work](https://paice.work/) project. See [ATTRIBUTION.md](ATTRIBUTION.md) for details.

The default semantic layer uses [gist](https://semanticarts.com/gist/) by Semantic Arts, Inc., licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Required attribution: "Semantic Arts, Inc. gist ontology (CC BY 4.0) https://semanticarts.com/gist".

## Deploying

When you use this template, update the following:

1. Edit `project.yml` with your domain entities, colors, and site identity
2. Replace example data in `data/examples/` with your own
3. Update `docs/CNAME` with your custom domain (or remove it)
4. Push to GitHub and publish using your chosen Pages workflow or artifact strategy

## Sponsor

Knowledge as Code is free and open. If you build on this template, consider [sponsoring its development](https://github.com/sponsors/snapsynapse). See [SPONSORS.md](SPONSORS.md).

## About

Knowledge as Code is a [PAICE.work](https://paice.work/) project. PAICE.work PBC is a public benefit corporation building infrastructure for productive collaboration between humans and autonomous agents. Structured, version-controlled, agent-accessible knowledge is a foundation for that collaboration.

## License

MIT
