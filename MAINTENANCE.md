# Maintenance

## Support status

Knowledge-as-Code is actively used internally and maintained as an open utility. Public support is best effort. There is no guaranteed response time, release schedule, or commitment to implement requested features.

## Supported path

The maintained public path is:

1. Run the initializer from a clean checkout.
2. Edit `project.yml` and the generated `data/` tree.
3. Run validation, build, verification, evals where included, and link checking.
4. Deploy the generated `docs/` artifact with the included GitHub Pages workflow or another static host.
5. Optionally run the local MCP server over standard input and output.

The current supported runtime is Node.js 18 or later on macOS and Linux. Windows may work but is not part of the tested support promise.

## Accessibility gate

The canonical CI scans the generated template, canonical root landing, and canonical demo with the immutable A11y Audit identity and fail-closed major-findings policy recorded in [the 2026-09-07 accessibility adoption evidence](audits/a11y-2026-09-07.md). The generator keeps its Node.js 18-or-later support promise; the accessibility job selects its scanner's required Node.js 22 runtime explicitly.

## Maintenance priorities

Work is prioritized in this order:

1. Security vulnerabilities and unsafe generated output
2. Incorrect validation or evidence results
3. Breakage in the initializer, build, or deployment golden path
4. Reproducibility and portability defects
5. Documentation failures reproduced by an independent user
6. Features needed by active internal deployments
7. Other enhancements when maintainer capacity permits

## Compatibility

Patch releases may fix correctness, security, documentation, and generated output. Minor releases may add backward-compatible configuration or output. Breaking configuration, API, route, or MCP changes require a major version or a documented migration path. For the 1.2.0 stricter validation changes, see [MIGRATION.md](MIGRATION.md).

Generated HTML appearance is not a stable API. JSON API fields, entity IDs, routes, configuration keys, MCP tool contracts, and the mapping keys `regulation` and `obligations` are compatibility surfaces.

## Contributions

Bug reports with a minimal reproduction are the most useful public contribution. Small fixes that preserve the zero-dependency core and supported path are welcome. A pull request may be correct and still remain unmerged if it expands the permanent maintenance surface beyond current capacity.

Domain-specific adapters and model integrations should generally live outside this repository and use the external verifier contract.

## Releases and deprecation

There is no fixed release cadence. Releases are cut when a coherent set of tested changes is ready. A deprecated compatibility surface should remain available for at least one minor release when practical and be called out in the changelog.

If the project becomes maintenance-only or archived, the README will say so plainly. The last working release and MIT license will remain available.

## Security

See `SECURITY.md` for private reporting and the supported security scope.
