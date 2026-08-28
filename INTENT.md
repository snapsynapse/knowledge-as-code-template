# Intent

## Status

Knowledge-as-Code is an internal-first open utility maintained by PAICE.work PBC. It is used inside the PAICE and Snap Synapse portfolios and published under MIT so others can inspect, reuse, and improve it.

The project is not pursuing broad developer mindshare as an end in itself. Public adoption is useful when it demonstrates that the generator transfers to a new domain without maintainer interpretation.

## Purpose

Maintain a small, portable generator for evidence-backed structured references that need:

- Git-tracked source files readable without proprietary tooling
- a configurable Primary, Container, Authority, and Secondary entity model
- deterministic validation, drift detection, and reproducible output
- a static human-readable site and JSON API from the same source
- an optional local MCP interface

## Intended users

The narrow primary audience is a technically capable maintainer who owns a reference dataset, needs evidence and review dates to remain visible, and wants to publish without a database or hosted application runtime.

The project is a poor fit for collaborative editing by nontechnical teams, transactional applications, high-volume ingestion, or knowledge domains without a stable ontology.

## Operating model

- Internal portfolio use funds the maintenance floor.
- The clean initializer is the supported adoption path.
- The example is a testable teaching fixture, not an authoritative security reference.
- Public support is best effort with no response-time commitment.
- Correctness, security, portability, and the supported golden path take priority over feature breadth.
- Integrations belong behind documented provider-independent contracts.

## Viable open-repository end state

The repository is sustainable when it remains useful internally even if external adoption is zero, while an independent user can still understand, initialize, verify, build, and deploy it from public documentation alone.

A mature end state has:

- one stable 1.x generator and initializer
- zero required runtime dependencies beyond supported Node.js
- a bounded compatibility and security policy
- reproducible tests for the public golden path
- a small release surface driven by internal needs, security findings, and independently reproduced user problems
- documented extension contracts instead of bundled vendor integrations
- no implied service-level agreement, fixed roadmap dates, or obligation to accept features

## Adoption evidence

Repository traffic, stars, social engagement, and maintainer-assisted demos are weak signals. The meaningful gate is an external pilot completed without live maintainer help. See `ADOPTION.md`.

Until that gate is passed, claims should say the project is used internally and available for external reuse. They should not imply independent adoption.

## Roadmap

Roadmap items are directional and evidence-gated. They do not imply delivery dates or a support commitment.

### GuideCheck implementation

Make GuideCheck a first-class generated implementation, not only a conformance profile adopted by this canonical repository.

- Generate the canonical assistant guide, root compatibility copy, and integrity sidecar for initialized Knowledge-as-Code projects.
- Derive project-specific guide content from validated configuration instead of copying canonical-repository instructions.
- Validate guide discovery, byte identity, integrity metadata, action boundaries, and the highest truthfully supported GuideCheck level.
- Include GuideCheck output in the build, initializer, documentation, eval suite, and compatibility policy.
- Keep Level 5 reserved for deployments that provide and verify the required runtime behavior.

### Voluntary implementation registry

Provide an opt-in way for independent maintainers to report how they use Knowledge-as-Code and, with explicit permission, appear in a public library of implementations.

- Add a structured submission path for project name, public URL, repository when public, domain, short use-case description, maintainer identity or organization, and Knowledge-as-Code version.
- Require explicit consent before displaying a submission and provide a clear update or removal path.
- Verify that a submitted public implementation exposes a recognizable Knowledge-as-Code source or generated surface before listing it.
- Distinguish maintainer-operated examples, independent implementations, experiments, and completed adoption pilots.
- Publish the library from reviewable repository data so additions, corrections, provenance, and removal history remain auditable.
- Do not add telemetry, phone-home behavior, or automatic usage reporting to the generator.

## Reserved direction: Canon Map public home

Recorded 2026-06-09, migrated from a session disposition note on 2026-08-28.
This is a record, not a work order.

A portfolio competitive review on 2026-06-09 found docs-as-code to be a
saturated pattern; the durable novelty identified for this project is the
Canon Map scheme (a typed source-of-truth model: kind / scope / canonical
home / pointer convention / maintained by; pointers are one-line links, never
paraphrases; snapshots carry verified dates; append-only handoffs with
supersedes chains). It passed its acceptance gate at v0.0.3 in the ob1-paice
pilot on 2026-06-06.

knowledge-as-code.com is the staked term reserved as the eventual public home
of that pattern. The promotion path requires a second Canon Map pilot
(paice-foundation) and an explicit maintainer decision before any public
write-up lands here; external interest accelerates the promotion question but
does not bypass it. The 2026-07-21 recalibration to internal-first open
utility supersedes the "dormant" status the original note carried; this
reservation is unaffected by that change.

## Recalibration gates

- If the initializer cannot create a working project from a clean checkout, stop feature work and restore the golden path.
- If internal users stop using the generator, reassess whether the repository should enter maintenance-only status.
- If three independent pilots complete the golden path and request the same extension, consider it for the core.
- If an extension benefits only one deployment, keep it outside the core behind a documented contract.
- If maintenance cost exceeds internal value, preserve the last working release and archive the repository transparently.

## Non-goals

- Becoming a general-purpose knowledge-management platform
- Bundling an AI provider or hosted verification service
- Maintaining domain data on behalf of downstream users
- Optimizing for stars, launch traffic, or speculative integrations
- Promising a fixed release cadence

## Exceptions to Repo Standards

None currently recorded.

## Changelog

- 2026-08-28: Migrated the Canon Map public-home reservation from the 2026-06-09 session disposition note; processed and removed both session handoffs.
- 2026-07-25: Added GuideCheck generation and a voluntary, consent-based implementation registry to the roadmap.
- 2026-07-21: Recalibrated the project from adoption-seeking template to internal-first open utility; made independent transfer the public adoption gate.
