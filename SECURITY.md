# Security Policy

## Supported versions

Security fixes target the latest tagged release and the `main` branch. Older releases may receive guidance but are not guaranteed patches.

## Reporting a vulnerability

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/snapsynapse/knowledge-as-code-template/security/advisories/new). Do not open a public issue for an unpatched vulnerability.

Include the affected commit or version, reproduction steps, impact, and any proposed mitigation. Do not include real secrets or sensitive third-party data.

There is no guaranteed response-time SLA. The maintainer will assess credible reports as capacity permits and will prioritize issues that can execute code, escape intended output boundaries, expose secrets, or produce unsafe generated content.

## Scope

The security scope includes the initializer, parsers, validator, generator, verifier, link checker, MCP server, and included GitHub Actions workflows.

Domain accuracy, third-party source availability, downstream hosting configuration, external verifier implementations, and content added by forks are outside the repository's security guarantee.
