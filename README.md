# Knowledge-as-Code Template

A zero-dependency generator for evidence-backed reference sites. Keep structured knowledge in Git-tracked Markdown and YAML, then build a searchable HTML site, JSON API, discovery files, and an optional local MCP interface.

This repository is an internal-first open utility maintained by [PAICE.work](https://paice.work/) PBC. It supports active reference projects inside the PAICE and Snap Synapse portfolios. Public issues and contributions are welcome on a best-effort basis.

## Project status

- [Intent and viable end state](INTENT.md)
- [Maintenance and compatibility](MAINTENANCE.md)
- [Independent adoption pilot](ADOPTION.md)
- [Security policy](SECURITY.md)

## Who this is for

Maintainers of public registries, comparison databases, compliance maps, and other structured references where claims need sources, review dates, and machine-readable output.

## What problem it solves

Structured references often duplicate the same claims across a website, API, search index, and agent interface. This template keeps one typed source in plain text, validates its relationships and review dates, and generates consistent human- and machine-readable outputs.

## Canonical URL

https://knowledge-as-code.com/

## What it produces

**[Live demo →](https://knowledge-as-code.com/demo/)** — the output of this template's example data, deployed on GitHub Pages. Includes a searchable HTML site, coverage matrix, timeline, comparison tool, and JSON API.

Maintainer-operated implementations of this architecture:

- [AI Tool Watch](https://aitool.watch/) — AI model capabilities across 12 products
- [Every AI Law](https://everyailaw.com/) — global AI regulatory landscape
- [Virtual Classroom Watch](https://VirtualClassroom.watch/) — virtual classroom and meeting standards

## Quick Start

1. **Clone this generator** -- `git clone https://github.com/snapsynapse/knowledge-as-code-template.git`.
2. **Create a clean project** -- from the generator checkout, run `node scripts/init.js ../my-knowledge-base`. The guided initializer asks for the reference name, URL, repository, and plain-language names for the four entity roles.
3. **Enter the generated project** -- `cd ../my-knowledge-base`. It contains the engine, one worked example, the MCP runtime, and deployment workflows without this canonical site's landing files or history.
4. **Validate and build** -- run `node scripts/validate.js` and `node scripts/build.js`, then open `docs/index.html`.
5. **Deploy** -- create a GitHub repository, set Pages to **GitHub Actions**, and push to `main`. The included workflow builds and publishes `docs/`.
6. **Replace the example** -- use [`data/_schema.md`](data/_schema.md) and the worked records under `data/examples/` as the starting point for your domain.

For a reproducible non-interactive project using the starter labels, run `node scripts/init.js ../my-knowledge-base --defaults`. The initializer refuses to overwrite an existing target directory.

## Output Policy

This canonical repository tracks only the generated `demo/` published at `https://knowledge-as-code.com/demo/`.

- `docs/` is transient local output used by builds, tests, and initialized projects. It is ignored here.
- `demo/` is the tracked canonical reference build.
- Never edit either directory by hand. Build local output with `node scripts/build.js`; refresh the tracked demo with `KAC_OUTPUT_DIR=demo KAC_SITE_URL="https://knowledge-as-code.com/demo/" node scripts/build.js`.
- During each build, the generator removes only paths it owns in the target output directory (`api/`, `assets/`, entity/bridge page directories, and generated root files). It refuses to clean the repository root or a parent directory.

## What You Get

- **Static HTML site** — homepage, list pages, detail pages, coverage matrix, timeline, comparison tool
- **JSON API** — programmatic access at `docs/api/v1/`
- **Bridge pages** — SEO-targeted pages like "Does X require Y?"
- **Dark/light theme** — with persistence
- **Client-side search** — lazy-loaded, keyboard-navigable
- **Sortable tables** — click any column header to sort
- **Local MCP server** — optional read-only agent access through `mcp-server.js`; it runs separately from the static build
- **Discovery files** — llms.txt, agents.json, RSS for machine consumption
- **Safe generated output** — generated links, CSS tokens, and client-side comparison labels are normalized or escaped
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
  init.js            # Clean-project initializer (canonical repo only)
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

Generated pages normalize external URLs to `https` and bare domains. Avoid `http`, `javascript:`, and `www` in project data; unsafe protocols are dropped from generated links. Configured colors should be hex values such as `#4fc3f7`; invalid color values fall back to safe defaults.

Entity filenames and mapping IDs must be lowercase slug IDs: `a-z`, `0-9`, and single hyphens only, such as `access-control` or `iso-27001`. The filename without `.md` is the entity ID. Mapping references must use those same IDs. `node scripts/validate.js` and `node scripts/build.js` both reject unsafe IDs before generated HTML, filesystem paths, JSON discovery files, or MCP responses are produced.

## Replacing example data

The template ships with example data in `data/examples/` (ISO/IEC 27001, NIST CSF). To replace it with your own domain:

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

The build script looks for data in `data/examples/` first, then `data/`. You can rename `data/examples/` to `data/` if you prefer a flatter structure. Keep filenames slug-safe because the generated site, JSON API, MCP tools, search index, sitemap, and agents.json all use the filename-derived IDs.

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
- **Zero dependencies** — no npm install and no third-party runtime packages in the core
- **Bespoke static generation** — the build script _is_ the specification
- **GitOps** — Git is the single source of truth
- **Defensive output encoding** — data is treated as untrusted when emitted into HTML, CSS, URLs, or inline scripts

## AI Agent Support

Every Knowledge-as-Code site includes machine-readable discovery files:

- **Assistant Guide** -- `/.well-known/assistant-guide.txt` is a GuideCheck Level 4 guide for local verification and generated-output refresh work
- **MCP Server** -- `mcp-server.js` provides read-only access to all entities via Model Context Protocol
- **llms.txt** -- Generated at `docs/llms.txt` with entity model, API endpoints, and entity listings
- **agents.json** -- Machine-readable metadata at `docs/agents.json` for agent discovery
- **RSS feed** -- Recent updates at `docs/index.xml`
- **JSON API** -- Programmatic access at `docs/api/v1/`

### GuideCheck conformance

This repository adopts the [GuideCheck](https://guidecheck.org/) Human-Verifiable Assistant Guide profile at Level 4, the highest appropriate guide-file level. Level 5 is a runtime claim and is not asserted by this repository.

Published artifacts:

- `/.well-known/assistant-guide.txt` - canonical guide
- `/assistant-guide.txt` - repository-root copy, byte-identical to the canonical guide
- `/.well-known/assistant-guide-manifest.txt` - sidecar manifest carrying the guide hash and byte count

Assistants should verify the guide with `https://guidecheck.org/verify` or another conformant verifier, report the achieved level and SHA-256, and ask for explicit user confirmation before executing any action blocks.

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

`node scripts/verify.js` detects stale, never-reviewed, future-dated, and invalid entities; checks required evidence URLs; and validates cross-reference completeness. A weekly GitHub Actions workflow runs the deterministic checks and opens an issue when review is needed. It does not independently establish factual accuracy. An optional executable JSONL contract lets maintainers attach a local model, hosted service, browser workflow, or human-review adapter without changing the core.

See [VERIFICATION.md](VERIFICATION.md) for the deterministic checks, CI integration, and extension contract.

External transferability has a documented evidence gate. If you are evaluating the generator for a real new domain, follow [ADOPTION.md](ADOPTION.md) and submit the included pilot report instead of treating repository traffic or a maintainer-led demo as proof of adoption.

## Ecosystem

Knowledge as Code is part of a broader set of open standards:

- **[Graceful Boundaries](https://github.com/snapsynapse/graceful-boundaries)** — How services communicate operational limits to humans and agents
- **[Skill Provenance](https://github.com/snapsynapse/skill-provenance)** — Version identity that travels with agent skill bundles
- **[Siteline](https://siteline.to/)** — AI agent readiness scanner for websites
- **[Knowledge as Code](https://knowledge-as-code.com/)** — Canonical home and maintained reference implementation

## Design properties

This implementation combines six established practices:

1. **Plain-text canonical** — knowledge lives in human-readable, version-controlled files
2. **Drift-aware** — deterministic checks flag old review dates and incomplete relationships for human review
3. **Multi-output** — one source produces HTML, JSON, discovery files, and a separately run MCP interface
4. **Zero-dependency** — core scripts use Node.js built-ins only
5. **Git-native** — Git provides collaboration, audit history, and deployment triggers
6. **Ontology-driven** — configurable entity roles map stable concepts to changing sources and implementations

These ideas build on docs as code, living documentation, GitOps, and earlier uses of the term “knowledge as code.” The contribution here is a small working generator and a specific Primary/Container/Authority/Secondary reference model, not a claim to have originated the broader category. See [knowledge-as-code.com](https://knowledge-as-code.com/) for the maintained public explanation.

## Attribution

Knowledge as Code is a [PAICE.work](https://paice.work/) project. See [ATTRIBUTION.md](ATTRIBUTION.md) for details.

The default semantic layer uses [gist](https://semanticarts.com/gist/) by Semantic Arts, Inc., licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Required attribution: "Semantic Arts, Inc. gist ontology (CC BY 4.0) https://semanticarts.com/gist".

## Deploying

When you use this template, update the following:

1. Edit `project.yml` with your domain entities, colors, and site identity
2. Replace example data in `data/examples/` with your own
3. In GitHub, set Pages to **GitHub Actions**, then push to `main`; `.github/workflows/pages.yml` builds and publishes `docs/`

## Sponsor

Knowledge as Code is free and open. If you build on this template, consider [sponsoring its development](https://github.com/sponsors/snapsynapse). See [SPONSORS.md](SPONSORS.md).

## About

Knowledge as Code is a [PAICE.work](https://paice.work/) project. PAICE.work PBC is a public benefit corporation building infrastructure for productive collaboration between humans and autonomous agents. Structured, version-controlled, agent-accessible knowledge is a foundation for that collaboration.

## License

MIT
