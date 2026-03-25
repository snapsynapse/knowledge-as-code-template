# Architecture Patterns

## 1. File-over-App
Data lives in durable markdown files, not locked in an application database.

## 2. Docs-as-Code
Validation in CI, peer review via PR, version control via Git.

## 3. Zero-Dependency Build
All scripts use Node.js built-ins only. No npm install, no supply chain risk.

## 4. Config-Driven
`project.yml` is the single source of truth for domain configuration. The build script reads it and generates everything.

## 5. Ontology-Driven
A formal entity model governs the data structure. The ontology is documented in `ONTOLOGY.md` and configured in `project.yml`.

## 6. Bespoke Static Generation
A purpose-built generator compiles markdown into HTML and JSON. The code _is_ the specification.

## 7. GitOps
Git is the single source of truth. All state lives in commits.
