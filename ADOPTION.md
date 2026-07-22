# Independent Adoption Pilot

## Purpose

The adoption gate measures whether Knowledge-as-Code transfers to a new maintainer and domain without live interpretation from its author. It is a usability and product-fit test, not a promotion exercise.

Internal portfolio deployments, copied demos, repository stars, page views, and maintainer-led walkthroughs do not pass this gate.

## Pilot participant

The participant should be technically comfortable with Git, Markdown, YAML, and Node.js but should not have previously worked in this repository. They should bring a real reference domain with at least two stable concepts, one grouping or framework, one source authority, and one mapping.

## Rules

- Start from the public README and a clean checkout.
- Do not receive live setup help from the maintainer.
- Record questions and blockers as they occur instead of working around them silently.
- Do not use the canonical security example as the pilot domain.
- Stop if the process would require publishing confidential or regulated information.

## Tasks

1. Decide from the README whether the tool fits the domain.
2. Create a clean project with `scripts/init.js`.
3. Rename the four entity roles in plain domain language.
4. Replace the example with at least two primaries, one container, one authority, and one secondary mapping.
5. Attach an HTTPS evidence source and a truthful `last_verified` date.
6. Run validation, build, verification, and internal link checking.
7. Inspect the generated site and JSON API.
8. Deploy to a temporary static URL or document why deployment is out of scope.
9. File a pilot report using the GitHub issue template.

## Pass criteria

A pilot passes when:

- the participant correctly explains what the generator does and does not do
- the initialized repository contains no canonical landing-site material
- all required commands exit zero without source-code changes
- the participant can trace a generated page and JSON record back to its source file and evidence
- no live maintainer intervention is needed
- setup through local inspection takes no more than 90 minutes, excluding domain research and DNS
- every blocker and misleading instruction is captured

Deployment may be marked not applicable when organizational policy prevents it. All other criteria remain required.

## Decision rules

- One passing pilot establishes basic external transferability.
- Three passing pilots in distinct domains establish a repeatable supported path.
- A failure changes documentation or the golden path before another outreach attempt.
- Repeated requests from three independent pilots may justify a core feature. One-off needs remain extensions.
- Results are reported as pilots, not generalized adoption claims.

## Pilot report

Record the domain, environment, elapsed hands-on time, completed tasks, command output, blockers, unexpected concepts, and whether the participant would use the result again. Do not include secrets or proprietary source material.
