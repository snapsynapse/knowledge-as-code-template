# Contributing

This project follows a zero-dependency, config-driven approach. All domain-specific settings live in `project.yml`, and all scripts use only Node.js built-ins.

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
```yaml
---
name: ISO 27001
status: active
authority: iso
last_verified: 2025-01-15
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

```yaml
- id: provision-id
  regulation: framework-id
  obligations:
    - primary-id-1
    - primary-id-2
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
5. Commit the source files (`data/`, `project.yml`, `scripts/`). In this canonical repo, generated output in `docs/` and `demo/` is also tracked and should be regenerated rather than edited by hand. Template forks can choose whether `docs/` is committed or purely generated, depending on deployment strategy.
6. Open a PR against `main` with a clear description of what changed and why

## Container File Format

Container entity files have a specific structure with a timeline table and provision sections separated by `---`:

```markdown
---
name: Example Framework
status: active
authority: org-id
---

## Timeline

| Date | Event |
|------|-------|
| 2024-01-01 | Published |

---

## Provision Name

| Property | Value |
|----------|-------|
| Category | example |

### Requirements

| Requirement | Description |
|-------------|-------------|
| req-id | Details here |
```

See existing container files for complete examples.
