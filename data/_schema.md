# Data Schema

This file documents the file format for each entity type. All data files use the repository's bounded YAML subset in frontmatter followed by a markdown body. The parser supports indentation-based mappings, scalar strings (unquoted or quoted with JSON-compatible double-quote escapes or single quotes using doubled apostrophes), embedded colons, inline comments beginning with `#` after whitespace, block sequences, and the booleans and empty `[]`/`{}` values used by `project.yml`. It is not a full YAML implementation; keep data within these documented forms and avoid YAML features such as anchors, aliases, tags, and multiline scalars.

## Primary entities

**Directory:** `data/examples/{primary.directory}/` (configured in `project.yml` as `entities.primary.directory`)

**Example:** `requirements/access-control.md`

The filename without `.md` is the entity ID. It must be a lowercase slug using
only `a-z`, `0-9`, and single hyphens, such as `access-control`.

```yaml
---
id: access-control              # Required. Kebab-case identifier, must match filename
name: Access Control            # Required. Human-readable name
group: governance               # Required. Must match a group name in project.yml
status: active                  # Optional. Lifecycle state
last_verified: 2026-03-25       # Optional. Date of last verification check
search_terms:                   # Optional. Additional search keywords
  - authorization
  - permissions
---
```

**Body sections:** Defined in `project.yml` under `entities.primary.body_sections`. Each section is an `## H2` heading followed by markdown content. For the example config:

```markdown
## Summary

One paragraph describing the requirement.

## What Counts

- Concrete examples that satisfy this requirement

## What Does Not Count

- Anti-patterns or things that look similar but don't qualify
```

## Container entities

**Directory:** `data/examples/{container.directory}/`

**Example:** `frameworks/iso-27001.md`

The filename without `.md` is the container ID. It must be a lowercase slug
using only `a-z`, `0-9`, and single hyphens, such as `iso-27001`.

```yaml
---
name: ISO 27001                   # Required. Human-readable name
authority: iso                    # Required. ID of the authority entity
jurisdiction: International       # Required if scope_field is set in project.yml
type: standard                    # Optional. Category label
status: active                   # Required. Must match a status in project.yml
enacted: 2022-10-25              # Optional. Date of enactment
effective: 2022-10-25            # Optional. Date it took effect
official_url: https://...        # Optional. Link to official source; https only
last_verified: 2026-03-25        # Optional. Date of last verification check
---
```

**Body structure:** Container files have a specific structure that the build script parses. The body has two parts separated by `---`:

1. **Timeline table** (optional, when `has_timeline: true` in config)
2. **Provision sections** (one or more, separated by `---`)

```markdown
## Timeline

| Milestone | Date | Notes |
|-----------|------|-------|
| Published | 2022-10-25 | Initial release |
| Amendment | 2024-01-15 | Updated controls |

---

## Provision Title

| Property | Value |
|----------|-------|
| Obligation | access-control |
| Sections | Annex A.5-A.8 |
| Status | active |
| Effective | 2022-10-25 |
| Verified | 2026-03-25 |
| Checked | 2026-03-25 |

### Requirements

| Requirement | Details |
|-------------|---------|
| Access control policy | Define and enforce access control rules |

### Talking Point

> "A single quoted sentence for use in summaries or presentations."

### Sources

- [Source Name](https://source-url.com)

---

## Another Provision Title

(same structure as above)
```

**Important format requirements:**

- The `| Property | Value |` table is required for each provision. The `Obligation` row links this provision to a primary entity by ID.
- Provision sections are separated by `---` (horizontal rule).
- The `### Requirements` table is optional but recommended.
- The `### Talking Point` must be a blockquote with the text in double quotes.
- The `### Sources` section uses markdown link syntax.
- Source links should use `https` bare domains. The generated site drops unsafe protocols and normalizes `www` hostnames to bare domains.
- Markdown tables may include empty cells; empty cells are preserved instead of shifting later columns.

## Authority entities

**Directory:** `data/examples/{authority.directory}/`

**Example:** `organizations/iso.md`

The filename without `.md` is the authority ID. It must be a lowercase slug
using only `a-z`, `0-9`, and single hyphens, such as `iso`.

```yaml
---
id: iso                                           # Required. Kebab-case identifier
name: International Organization for Standardization  # Required. Full name
jurisdiction: International                       # Optional. Geographic scope
website: https://iso.org/                         # Optional. Official website; https only
last_verified: 2026-03-25                         # Optional. Verification date
---
```

**Body:** A list of container IDs that this authority produces:

```markdown
## Regulations

- iso-27001
- iso-42001
```

The heading name should match your container entity's plural name (e.g., "Regulations", "Products", "Frameworks").

## Mapping file

**Path:** `data/examples/mapping/index.yml` (configured in `project.yml` as `mapping.file`)

The mapping file connects containers to primaries through secondary (provision) entities. Mapping IDs and every entity reference must use the same lowercase slug format as filenames.

Replace: `iso-27001-access-control` -> a unique mapping ID for this provision.
Replace: `iso-27001` -> the mapped container filename ID.
Replace: `iso` -> the authority ID in that container's `authority` field.
Replace: `Confidentiality and Access` -> the exact parsed provision heading in the mapped container.
Replace: `data/examples/frameworks/iso-27001.md` -> the repository-relative path to that mapped container file.
Replace: `access-control` -> the primary entity filename ID this provision maps to.

Customize
```yaml
- id: iso-27001-access-control        # Required. Unique provision ID (kebab-case)
  regulation: iso-27001               # Required. Container file name (without .md)
  authority: iso                      # Required. Authority ID
  source_heading: Confidentiality and Access               # Required. Must match exactly one parsed provision in the mapped container
  source_file: data/examples/frameworks/iso-27001.md       # Optional. Repository-relative path that identifies the mapped container
  obligations:                        # Required. List of primary entity IDs this provision maps to
    - access-control
```

`regulation` and `obligations` are stable 1.x wire keys; their field names do not change with the display labels in `project.yml`. The `regulation` value is a container ID. Each `obligations` value is a primary ID. `authority` must match the mapped container's `authority` field. A provision's `Obligation` value must be a known primary ID and must be included in its mapping's `obligations` list; additional primary IDs remain supported. Generated provision cards display the union of the declared primary and all primary IDs mapped to that provision. `source_heading` must identify exactly one parsed provision section in that container; a timeline or another non-provision `##` heading does not qualify. `source_file`, when present, must identify that same container file, use a path relative to the repository root, and match the configured container directory. Supported mapping keys are `id`, `regulation`, `authority`, `source_file`, `source_heading`, and `obligations`. Unknown or duplicate keys, scalar `obligations`, duplicate obligation IDs, authority mismatches, unresolved source files, and headings that do not identify the mapped provision are rejected. `node scripts/validate.js`, `node scripts/build.js`, `node scripts/verify.js`, and `npm run eval` enforce this same mapping contract.

`source_file` is informational for tooling and traceability; the build script still resolves the container by `regulation` ID. If included, it must point to the same container named by `regulation`, use the path relative to the repo root, and match your configured `entities.container.directory`.

## File naming

- All files use lowercase slug filenames: `access-control.md`, `iso-27001.md`
- Slugs may contain only `a-z`, `0-9`, and single hyphens
- The filename without `.md` is used as the entity ID for primaries, containers, and authorities
- Mapping IDs and mapping references must use the same slug format
- `node scripts/validate.js` and `node scripts/build.js` reject unsafe IDs

## URL and style safety

- External URLs are emitted only when they parse as `https`.
- Hostnames beginning with `www.` are normalized to the bare domain in generated output.
- `javascript:`, `data:`, `http:`, and malformed external URLs are omitted from generated links.
- Group, status, and theme colors in `project.yml` should be hex colors. Invalid values fall back to safe defaults.
- Group and status names are normalized before use as CSS class names.
- Generated comparison-page labels are escaped before client-side insertion.
- Generated URL path segments are derived only from validated entity IDs.

## Adding new entities

1. Create the `.md` file in the appropriate directory
2. Add YAML frontmatter with required fields
3. If adding a container, create corresponding mapping entries in `mapping/index.yml`
4. Run `node scripts/validate.js` to check cross-references
5. Run `node scripts/build.js` to generate the site
