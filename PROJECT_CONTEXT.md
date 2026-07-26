# Project Context

## What this project is

`knowledge-as-code-template` is a zero-dependency, config-driven static site generator template for building version-controlled, ontology-first knowledge bases. Edit `project.yml` + add markdown data files, run `node scripts/build.js`, and get a full HTML site (list/detail pages, coverage matrix, timeline, comparison tool) plus a static JSON API, discovery files (llms.txt, agents.json, RSS), and an optional MCP server for agent access.

This repo is **two things at once**:

1. The reference template (MIT-licensed, fork-friendly) for the Knowledge-as-Code pattern.
2. The canonical landing site for that pattern at **knowledge-as-code.com** (hand-written `index.html`, `404.html`, etc. at repo root) plus its live reference build at `knowledge-as-code.com/demo/` (generated from `data/examples/` into `/demo/`).

The Knowledge-as-Code pattern itself was created by Sam Rogers ("Snap") for PAICE.work PBC, first published 2026-01-20 on snapsynapse.com, with the reference template following about two months later.

## Current status

Knowledge-as-Code is an internal-first open utility actively used inside the PAICE and Snap Synapse portfolios. `INTENT.md` is authoritative for current project status, operating model, recalibration gates, and non-goals. `MAINTENANCE.md` defines the supported public path.

An earlier 2026-06-09 portfolio review proposed maintenance-only status and reserving this surface for a possible future Canon Map pattern. That disposition is historical and was superseded by the 2026-07-21 recalibration recorded in `INTENT.md`. Do not use it as current guidance.

## Audience

- **Template consumers**: developers/teams evaluating or forking the template to build their own knowledge base (see README Quick Start, `CONTRIBUTING.md`, `data/_schema.md`).
- **knowledge-as-code.com visitors**: people landing on the pattern's canonical page, browsing the live demo, or citing the pattern.
- **Agents**: `AGENTS.md` / `CLAUDE.md` (identical, template-distributed) plus `llms.txt`, `.well-known/assistant-guide.txt`, and `mcp-server.js` give AI agents structured access to both the template internals and the example knowledge base.

## Style / tone

Documentation is terse, engineering-oriented, and precise — favors numbered quick-start steps, explicit file-path tables, and "do not edit generated output" warnings over marketing prose. Changelog follows Keep a Changelog + SemVer.

## Key URLs

- Canonical site: https://knowledge-as-code.com/
- Live demo: https://knowledge-as-code.com/demo/
- Repo: https://github.com/snapsynapse/knowledge-as-code-template
- Pattern origin post: https://snapsynapse.com/insights/knowledge-as-code/
- Built examples referenced in README: https://aitool.watch/, https://everyailaw.com/, https://VirtualClassroom.watch/

## Key files

- `project.yml` — domain/ontology configuration (the key file consumers edit)
- `scripts/build.js`, `scripts/validate.js`, `scripts/verify.js`, `scripts/check-links.js` — generator toolchain (see `package.json` scripts: `build`, `validate`, `verify`, `check-links`, `eval`)
- `data/examples/` — source markdown for the example/demo knowledge base
- `docs/` — template-default generated output; `demo/` — this repo's canonical reference build
- `MANIFEST.yaml` + `scripts/validate-hashes.sh` — content-provenance hash verification, checked in CI when present
- `.github/workflows/build.yml` — push/PR CI: hash verification, cross-reference validation, sanity builds of both `docs/` and `demo/`
- `.github/workflows/verify.yml` — weekly (Mon 09:00 UTC) staleness/drift check that files a GitHub issue on failure
