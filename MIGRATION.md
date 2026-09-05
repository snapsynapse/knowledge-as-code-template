# Migration

## Upgrading to 1.2.0

Version 1.2.0 preserves the 1.x entity IDs, routes, JSON API fields, MCP tool names, and mapping keys `regulation` and `obligations`. It enforces the documented source relationships consistently in validation, builds, verification, and MCP startup. Previously accepted incomplete or contradictory records now fail before generated output is replaced or MCP data is served.

Copy the updated `scripts/` runtime and `mcp-server.js` into an existing initialized project while preserving its `project.yml`, data, project identity, and project version. Include the new `scripts/lib/validation.js` and `scripts/lib/output-safety.js` modules. Fresh projects receive them through the initializer. Keep canonical-repository-only `scripts/init.js`, `scripts/eval.js`, and `scripts/validate-hashes.sh` out of initialized projects unless you deliberately maintain those workflows.

### Repair mapping provenance

Each mapping must:

- Reference existing container, authority, and primary IDs.
- Use the same `authority` as its container.
- Provide `source_heading` matching exactly one parsed provision in that container.
- Include that provision's required `Obligation` primary in its `obligations` list. Additional primaries remain supported and appear on provision cards.
- Point `source_file`, when present, to that same container using a repository-relative path.

For the shipped ISO example, a record missing `source_heading` or naming `nist` as its authority is invalid. This is the corrected complete record, suitable for replacing the corresponding entry in `data/examples/mapping/index.yml`.
Literal
```yaml
- id: iso-27001-access-control
  regulation: iso-27001
  authority: iso
  source_file: data/examples/frameworks/iso-27001.md
  source_heading: Confidentiality and Access
  obligations:
    - access-control
```
For another domain, use the same fields with IDs and provision headings from that project's source files. See [Data schema](data/_schema.md).

### Check quoted values

Quoted scalars now decode their delimiters and escapes. For example, a YAML scalar `"Access Control"` becomes the value `Access Control`. To retain literal quote characters in a value, encode them inside the quoted scalar, such as `"\"Access Control\""`. Inline comments following whitespace are excluded from values. Initializer names and labels round-trip through the same supported scalar rules.

### Check output paths

Build output must be a repository child without symlinked components below the repository root. Replace a symlinked output directory with a real directory and publish that artifact through the hosting workflow. Existing generated paths are removed during a successful build; unrelated files outside those owned paths are preserved.

### Verify the upgrade

Run these commands from the upgraded project after correcting its data. Freshness findings require a real evidence review; do not advance `last_verified` merely to make verification pass.
Literal
```bash
node scripts/validate.js
node scripts/build.js
node scripts/verify.js
node scripts/check-links.js
```
For the canonical generator checkout, also run `npm run eval` and regenerate `demo/` using the documented deployment overrides. See [Deployment](DEPLOYMENT.md) and [Maintenance](MAINTENANCE.md).
