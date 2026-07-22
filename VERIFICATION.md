# Verification

The Knowledge-as-Code template includes deterministic verification that detects stale entities, validates evidence metadata, and checks cross-reference integrity. It tells maintainers what needs review; it does not independently prove that a claim is factually current.

## How It Works

The verification script (`scripts/verify.js`) performs three deterministic categories of checks:

### Staleness Detection

Each entity file can include a `last_verified` date in its YAML frontmatter. The script compares this date against a configurable threshold to identify entities that may contain outdated information.

Entities are reported in three categories:
- **Fresh** — verified within the staleness window
- **Stale** — `last_verified` date exceeds the threshold
- **Never verified** — no `last_verified` field present

Invalid calendar dates and future verification dates are also failures.

### Cross-Reference Checking

The script validates that:
- Every container has at least one mapping entry
- Every mapping references valid primary entity IDs
- Every mapping references valid container IDs

### Evidence Metadata

The verifier checks every evidence URL found in entity frontmatter or content for valid HTTPS syntax. Projects may require at least one evidence URL for selected entity roles. The starter configuration requires evidence for containers because they carry the claims that map to stable primary concepts.

## Setup

Add `last_verified: YYYY-MM-DD` to any entity's frontmatter and set the staleness window in `project.yml`:

```yaml
verification:
  staleness_days: 90
  require_evidence_roles:
    - container
```

When you review an entity and confirm its content is current, update the date. Entities without `last_verified` are reported as "never verified."

## Running Verification

```bash
node scripts/verify.js
```

The script exits with code 0 when every configured check passes, code 1 when review is required, and code 2 for an invalid external-verifier configuration. Stale, never-verified, invalid-date, mapping, evidence, and external-review findings all produce a nonzero result.

## GitHub Actions Workflow

The included workflow (`.github/workflows/verify.yml`) runs verification on a weekly schedule (Mondays at 9am UTC) and can be triggered manually via `workflow_dispatch`.

The workflow captures the verifier exit code explicitly, stores it in a step output, and then opens or updates a drift issue when verification fails. That keeps the automation actionable without relying on `continue-on-error`.

## External verifier contract

Factual review is deliberately separate from the deterministic core. Maintainer-operated implementations may use human research, local models, hosted models, browser automation, or multiple independent reviewers. The repository provides a provider-independent executable boundary instead of a model integration.

Set `KAC_VERIFY_COMMAND` to an executable path. Set `KAC_VERIFY_ARGS` to an optional JSON array of string arguments and `KAC_VERIFY_TIMEOUT_MS` to an optional timeout. The command runs directly without a shell.

```bash
KAC_VERIFY_COMMAND=./tools/review-entities \
KAC_VERIFY_ARGS='["--offline"]' \
node scripts/verify.js
```

The verifier writes one JSON object per line to the command's standard input:

```json
{"id":"iso-27001","role":"container","title":"ISO/IEC 27001:2022","last_verified":"2026-07-21","urls":["https://iso.org/standard/27001"],"content":"..."}
```

The command must return exactly one JSON object per entity on standard output. Additional logs belong on standard error.

```json
{"id":"iso-27001","role":"container","status":"current","issues":[]}
```

Passing statuses are `current`, `pass`, and `ok`, case-insensitive. Every other status requires review. Missing entities, malformed JSONL, command failures, and timeouts also fail verification. The extension never edits source files or advances `last_verified`; a maintainer does that only after reviewing the evidence.
