# Ontology

## Core Principle

Every knowledge domain has stable concepts and unstable implementations. The ontology separates them:

- **Primary entities** are stable anchors — they don't change when sources change
- **Container entities** group implementations — they change when sources are amended
- **Secondary entities** (provisions) bridge containers to primaries — they're the mapping layer
- **Authority entities** are the sources that produce containers

## Relationship

```
Authority → Container → Secondary → Primary
```

## Rules

1. Primaries are stable; containers are unstable
2. Prefer relationships over buckets
3. Plain-English naming over jargon
4. IDs are kebab-case slugs
5. Every claim needs a date

## Configuration

The ontology is defined in `project.yml`. Entity names, groups, statuses, and relationships are all configurable. The build script reads this config and generates the site accordingly.
