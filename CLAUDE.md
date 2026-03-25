# Knowledge-as-Code Project

A config-driven knowledge base using an ontology-first approach. All domain-specific settings are in `project.yml`.

## Project Structure

```
project.yml           # Domain configuration (THE key file)
data/
  examples/           # Data files (one .md per entity)
    primary/          # Stable anchor entities
    container/        # Grouping entities with provisions
    authority/        # Source entities
    mapping/          # index.yml connecting containers to primaries
scripts/
  build.js            # Config-driven site generator
  validate.js         # Cross-reference validator
docs/                 # Generated output (HTML + JSON API)
  api/v1/             # Static JSON API
```

## Key Commands

```bash
node scripts/build.js      # Build site + JSON API
node scripts/validate.js   # Validate cross-references
```

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

1. Create a `.md` file in the appropriate `data/` directory
2. Add YAML frontmatter with required fields (see existing files for format)
3. For containers: add timeline table and provision sections separated by `---`
4. Add mapping entries to `data/examples/mapping/index.yml`
5. Run `node scripts/validate.js` to check cross-references
6. Run `node scripts/build.js` to generate the site

## Customization

Edit `project.yml` to change:
- Entity names and directories
- Group categories and colors
- Status types and colors
- Site name, URL, and navigation
- Bridge page patterns
- Theme accent colors
