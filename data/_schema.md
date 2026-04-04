# Data Schema

This file documents the file format for each entity type. All data files use YAML frontmatter followed by a markdown body.

## Primary entities

**Directory:** `data/examples/{primary.directory}/` (configured in `project.yml` as `entities.primary.directory`)

**Example:** `requirements/access-control.md`

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

```yaml
---
name: ISO 27001                   # Required. Human-readable name
authority: iso                    # Required. ID of the authority entity
jurisdiction: International       # Required if scope_field is set in project.yml
type: standard                    # Optional. Category label
status: active                   # Required. Must match a status in project.yml
enacted: 2022-10-25              # Optional. Date of enactment
effective: 2022-10-25            # Optional. Date it took effect
official_url: https://...        # Optional. Link to official source
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

## Authority entities

**Directory:** `data/examples/{authority.directory}/`

**Example:** `organizations/iso.md`

```yaml
---
id: iso                                           # Required. Kebab-case identifier
name: International Organization for Standardization  # Required. Full name
jurisdiction: International                       # Optional. Geographic scope
website: https://www.iso.org                      # Optional. Official website
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

The mapping file connects containers to primaries through secondary (provision) entities:

```yaml
- id: iso-27001-access-control        # Unique provision ID
  regulation: iso-27001               # Container file name (without .md)
  authority: iso                      # Authority ID
  source_heading: Information Security Controls (Annex A)  # Must match an ## H2 in the container file
  obligations:                        # List of primary entity IDs this provision maps to
    - access-control
```

The `regulation` field should use your container entity name from config (the field name comes from `project.yml`). The `obligations` field should use your primary entity name from config.

## File naming

- All files use kebab-case: `access-control.md`, `iso-27001.md`
- The filename (without `.md`) is used as the entity ID for primaries and authorities
- Container files use the `name` frontmatter field (lowercased, spaces replaced with hyphens) as their ID

## Adding new entities

1. Create the `.md` file in the appropriate directory
2. Add YAML frontmatter with required fields
3. If adding a container, create corresponding mapping entries in `mapping/index.yml`
4. Run `node scripts/validate.js` to check cross-references
5. Run `node scripts/build.js` to generate the site
