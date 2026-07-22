# Verification

The Knowledge-as-Code template includes deterministic verification that detects stale entities and validates cross-reference integrity. It tells maintainers what needs review; it does not independently prove that a claim is factually current.

## How It Works

The verification script (`scripts/verify.js`) performs two categories of checks:

### Staleness Detection

Each entity file can include a `last_verified` date in its YAML frontmatter. The script compares this date against a configurable threshold to identify entities that may contain outdated information.

Entities are reported in three categories:
- **Fresh** — verified within the staleness window
- **Stale** — `last_verified` date exceeds the threshold
- **Never verified** — no `last_verified` field present

### Cross-Reference Checking

The script validates that:
- Every container has at least one mapping entry
- Every mapping references valid primary entity IDs
- Every mapping references valid container IDs

## Setup

Add `last_verified: YYYY-MM-DD` to any entity's frontmatter and set the staleness window in `project.yml`:

```yaml
verification:
  staleness_days: 90   # default; use 30 for fast-moving domains, 180 for stable reference data
```

When you review an entity and confirm its content is current, update the date. Entities without `last_verified` are reported as "never verified."

## Running Verification

```bash
node scripts/verify.js
```

The script exits with code 0 if no entities are stale, and code 1 if any stale entities are found. This makes it suitable for CI pipelines.

## GitHub Actions Workflow

The included workflow (`.github/workflows/verify.yml`) runs verification on a weekly schedule (Mondays at 9am UTC) and can be triggered manually via `workflow_dispatch`.

The workflow captures the verifier exit code explicitly, stores it in a step output, and then opens or updates a drift issue when verification fails. That keeps the automation actionable without relying on `continue-on-error`.

## External verification

Factual review is deliberately separate from the deterministic core. Maintainer-operated implementations may use human research, local models, hosted models, browser automation, or multiple independent reviewers. Those systems are case-study integrations, not functionality included in this repository.

The planned extension boundary is a provider-independent command contract: entity JSON on standard input and a structured review result on standard output. Until that contract ships, use the deterministic report as a review queue and update `last_verified` only after checking the underlying evidence.
