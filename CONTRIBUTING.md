# Contributing

This project follows a zero-dependency, config-driven approach. All domain-specific settings live in `project.yml`, and all scripts use only Node.js built-ins.

Read [MAINTENANCE.md](MAINTENANCE.md) before proposing a feature. Reproducible defects in the supported golden path take priority over maintenance-surface expansion. New adopters can report a documentation-only trial through [ADOPTION.md](ADOPTION.md).

## Adding Entities

### 1. Create the Markdown File

Create a `.md` file in the appropriate `data/examples/` subdirectory:

| Entity Role | Directory | Example |
|-------------|-----------|---------|
| Primary | `data/examples/requirements/` | `data-encryption.md` |
| Container | `data/examples/frameworks/` | `iso-27001.md` |
| Authority | `data/examples/organizations/` | `iso.md` |

Directory names are configured in `project.yml` under `entities.<role>.directory`.

### 2. Add YAML Frontmatter

Every entity file starts with YAML frontmatter between `---` delimiters. See existing files for the required fields. At minimum:

**Primary entities:**
```yaml
---
id: data-encryption
name: Data Encryption
group: technical
last_verified: 2025-01-15
---
```

**Container entities:**

Replace: `ISO/IEC 27001:2022` -> the container's human-readable name.
Replace: `iso` -> the ID of the authority file that produces this container.
Replace: `International` -> the jurisdiction or scope value required by `project.yml`.

Customize
```yaml
---
name: ISO/IEC 27001:2022
authority: iso
jurisdiction: International
status: active
---
```

**Authority entities:**
```yaml
---
id: iso
name: International Organization for Standardization
last_verified: 2025-01-15
---
```

### 3. Add Mapping Entries

For containers that reference primary entities, add entries to `data/examples/mapping/index.yml` (or the path configured in `project.yml` under `mapping.file`):

Replace: `iso-27001-access-control` -> a unique mapping ID for this provision.
Replace: `iso-27001` -> the mapped container filename ID.
Replace: `iso` -> the authority ID in that container's `authority` field.
Replace: `Confidentiality and Access` -> the exact parsed provision heading in the mapped container.
Replace: `data/examples/frameworks/iso-27001.md` -> the repository-relative path to that mapped container file.
Replace: `access-control` -> the primary entity filename ID this provision maps to.

Customize
```yaml
- id: iso-27001-access-control
  regulation: iso-27001
  authority: iso
  source_heading: Confidentiality and Access
  source_file: data/examples/frameworks/iso-27001.md
  obligations:
    - access-control
```

### 4. Validate and Build

```bash
# Check cross-references
node scripts/validate.js

# Check staleness and completeness
node scripts/verify.js

# Build the site and JSON API
node scripts/build.js
```

Fix any errors reported by `validate.js` before submitting.

## Modifying the Ontology

The entity model is defined in `project.yml` under `entities:`. Each role has:

- `name` — singular display name
- `plural` — plural display name
- `directory` — subdirectory under `data/examples/`
- Role-specific fields (groups, statuses, etc.)

When changing entity names or directories:
1. Update `project.yml`
2. Rename the corresponding data directory
3. Run `validate.js` to confirm references still resolve
4. Run `build.js` to regenerate the site

## Code Style

- **Zero dependencies.** All scripts use only Node.js built-ins. Do not add npm packages.
- Use the existing YAML parser (`parseYaml`) rather than importing a YAML library.
- Keep functions pure where possible.
- Use `'use strict'` at the top of every script.

## Testing Changes Locally

```bash
# 1. Validate cross-references
node scripts/validate.js

# 2. Check entity freshness
node scripts/verify.js

# 3. Build the site
node scripts/build.js

# 4. Preview locally (any static file server works)
npx serve docs
# or
python3 -m http.server -d docs 8000
```

Check the generated `docs/` directory for the HTML site and `docs/api/v1/` for the JSON API.

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes (add entities, update config, fix bugs)
3. Run `npm run eval` — this is the preferred final verification pass before a PR
4. Use `npm run validate`, `npm run verify`, or `npm run build` directly when you want a narrower check while iterating
5. Commit the source files (`data/`, `project.yml`, `scripts/`). In this canonical repo, `docs/` is ignored transient output and `demo/` is the only tracked generated build. Regenerate `demo/` rather than editing it by hand.
6. Open a PR against `main` with a clear description of what changed and why

## Container File Format

Container entity files have a specific structure with a timeline table and provision sections separated by `---`:

Replace: `ISO/IEC 27001:2022` -> the container's human-readable name.
Replace: `iso` -> the authority ID that produces this container.
Replace: `International` -> the jurisdiction or scope value required by `project.yml`.
Replace: `Confidentiality and Access` -> the provision heading referenced by the mapping entry.
Replace: `access-control` -> the primary entity filename ID linked by this provision.

Customize
```markdown
---
name: ISO/IEC 27001:2022
status: active
authority: iso
jurisdiction: International
---

## Timeline

| Milestone | Date | Notes |
|-----------|------|-------|
| Published | 2022-10-25 | ISO/IEC 27001:2022 released |

---

## Confidentiality and Access

| Property | Value |
|----------|-------|
| Obligation | access-control |
| Sections | ISO public overview |
| Status | active |
| Effective | 2022-10-25 |
| Verified | 2026-07-21 |
| Checked | 2026-07-21 |

### Requirements

| Requirement | Details |
|-------------|-------------|
| Confidential access | Ensure only the right people can access information |
| Risk management | Manage risks to information handled by the organization |
```

See existing container files for complete examples.
