---
title: "Search indexing"
purpose: "Property-specific index policy, evidence governance, action ledger, and console follow-up for knowledge-as-code.com."
status: active
updated: 2026-08-20
owner: "snapsynapse"
open_tasks:
  - "Implement the repository search contract (search-audit.config.json plus offline and production validators)"
  - "Emit JSON-LD on demo bridge pages"
  - "Decide whether /.well-known/assistant-guide.txt stays a sitemap entry"
---
# Search indexing

Living property document. The reusable method lives in the
`portfolio-search-indexing-audit` skill and is read-only during an audit. This
repository is authoritative for this property's policy, evidence, and ledger.
The cross-property queue in LocalBrain links here and does not duplicate it.

The audit unit is one search property. This repository owns exactly one.

## Property identity

| Field | Value |
|---|---|
| Canonical origin | `https://knowledge-as-code.com/` |
| Property mode | `website` |
| Google Search Console property ID | `sc-domain:knowledge-as-code.com` |
| Bing Webmaster Tools property ID | not configured |
| Owning repository | `/Users/snap/Git/knowledge-as-code-template` |
| Hosting | GitHub Pages, serving `main` branch root |
| Deploy trigger | push to `main`, via the `pages build and deployment` run |

### Source, generated output, and deployment boundary

This repository is both the reference template and the canonical landing site,
so the boundary is unusual and worth stating precisely.

| Path | Role | Deployed |
|---|---|---|
| `/index.html`, `/404.html`, `/sitemap.xml`, `/robots.txt`, `/imgs/`, `/favicon.svg`, `/.well-known/` | Hand-written landing site | Yes, at the origin root |
| `/demo/` | Generated artifact, built from `data/examples/` | Yes, at `/demo/` |
| `/data/examples/` | Markdown source for `/demo/` | Yes, served raw as `text/markdown` |
| `/docs/` | Template-default build output | No. Gitignored, never deployed, 404 in production |

There is no staging directory. GitHub Pages publishes the branch root as-is, so
the deployable artifact and the repository tree are the same thing. `.nojekyll`
is what keeps `/.well-known/` and raw `.md` served rather than swallowed.

`pages.yml` is gated `if: github.repository != 'snapsynapse/knowledge-as-code-template'`
and never runs here. It exists for template forks, which build and deploy
`docs/`. Do not read a skipped `pages.yml` as a failed deployment.

`BUILD_DAY` in `scripts/build.js` derives from the maximum container date rather
than wall clock, so generated output is reproducible and safe to diff in CI.

## Index policy

| Surface | Policy | Reason |
|---|---|---|
| `/` landing page | Index, in `/sitemap.xml` | Canonical page for the pattern |
| The 22 pages in `demo/sitemap.xml` | Index, in `demo/sitemap.xml` only | Reference implementation, the substantive reader destinations |
| `/404.html`, `/demo/404.html` | `noindex`, omit from every sitemap | Not content destinations |
| `robots.txt`, both sitemaps, `/llms.txt`, `/demo/llms.txt`, `/demo/agents.json`, `/demo/index.xml`, `/demo/api/v1/*.json` | Crawlable machine surfaces, omit from HTML sitemaps | Machine consumption, not canonical HTML |
| `/data/examples/**.md` | Crawlable, omit from sitemaps | Published deliberately for the landing page's "see the source" links. Expect these under `Crawled - currently not indexed`. |
| `/assistant-guide.txt` and `/.well-known/assistant-guide.txt` | Crawlable machine surfaces | Byte-identical duplicates at two paths. Only the `.well-known` copy is in a sitemap. See open policy decision below. |
| `www` to bare, `http` to `https` | Expected redirects | A domain property sees every host and scheme variant |
| `/docs/`, pre-consolidation root routes, all `data-quality` routes | Expected 404 | Retired, see below |

Two sitemaps, no overlap. `/sitemap.xml` owns the landing page and the assistant
guide. `demo/sitemap.xml` owns the entire demo tree, including `/demo/` itself,
and is the single source of truth for it. Do not re-add `/demo/` to the root
sitemap: two entries for one URL drift apart, and did.

### Multilingual policy

Not applicable. The property is single-language (`og:locale` `en_US`, `<html lang="en">`),
publishes no translated variants, and declares no `hreflang`. There are no
localized routes, no untranslated variants to noindex or 404, and no reciprocal
cluster to verify. Revisit only if translations are introduced.

### Retired route history

Needed to read old console rows correctly.

- `d61d585` moved the built site from the repository root into `/demo/`. Every bare root route such as `/containers.html` or `/primary/<id>/` has 404ed since.
- `b10f2d6` replaced the `data-quality` entity with `information-integrity`. Both `/primary/data-quality/` and `/demo/primary/data-quality/` 404 and should stay that way.

### Open policy decision

Whether `/.well-known/assistant-guide.txt` should remain a sitemap entry. It is
`text/plain`, so it is a machine surface by the table above, yet it is currently
declared in `/sitemap.xml`. Also unresolved: whether the byte-identical copy at
`/assistant-guide.txt` should stay crawlable at both paths. Neither is a defect;
both need an owner decision. Recorded as unresolved rather than silently
settled.

## Classification vocabulary

Every finding and every console row gets exactly one class.

| Class | Meaning |
|---|---|
| Defect | Repository or production contradicts this policy. Fix at source. |
| Pending recrawl | Production is correct and the provider's evidence predates it. Wait. |
| Expected noise | The row matches this policy. Document, do not act. |
| Policy decision | Index intent genuinely unresolved. Ask the owner. |
| External limitation | The provider prevents the desired exact behaviour. Document the bound. |
| Unknown | Not yet observed. Never a synonym for zero. |

Missing, stale, insufficient, unknown, and zero are five distinct states. A
report that has not populated is not a report showing zero. A metric with
insufficient field data is not a failing metric. An action not performed is not
an action that returned nothing.

## Validation lanes

| Lane | Command | State |
|---|---|---|
| Offline search contract | `node scripts/check-search.mjs` | Not yet implemented. See open task. |
| Production search contract | `node scripts/check-production-search.mjs` | Not yet implemented. See open task. |
| Cross-reference validation | `node scripts/validate.js` | Implemented, in CI |
| Freshness and drift | `node scripts/verify.js` | Implemented, weekly workflow |
| Link integrity | `KAC_LINK_CHECK_DIR=demo node scripts/check-links.js` | Implemented |
| Content hashes | `./scripts/validate-hashes.sh` | Implemented, in CI |
| Contract and surface evals | `node scripts/eval.js` | Implemented, in CI |

Until the two search contracts exist, the 2026-08-20 checks stand as the
evidence, and equivalent checks must be re-run by hand at each review. That is
the reason the contract is the top open task.

## Evidence governance

| Class | Location | Rule |
|---|---|---|
| Sanitized dated observations | `ops/search/<provider>/YYYY-MM-DD/audit.md` | Tracked, public-safe, independently reviewable |
| Living policy and ledger | this file | Tracked, current state only |
| Raw exports and authenticated artifacts | `.search-evidence-private/` or outside the repository | Ignored, never committed |
| Browser artifacts | `.playwright-mcp/` | Ignored, never committed |
| Cross-property sequencing | LocalBrain `0_Across/Search Property Queue.md` | One row, links here, no detail |

This repository is public. Never commit account identity, private search
queries, authenticated URLs, raw provider exports, screenshots, traces, cookies,
browser profiles, or unreviewed downloads. Never place private evidence beneath
a deployed directory: on this property the entire repository root is deployed,
so there is no safe in-tree location for raw artifacts at all.

Preserve prior dated evidence exactly. Never rewrite a historical observation
because provider state later changed; add a new dated file instead.

## Current classified state

As of 2026-08-20. Evidence: [`ops/search/GoogleSearchConsole/2026-08-20/audit.md`](search/GoogleSearchConsole/2026-08-20/audit.md).

| Lane | Date | Result |
|---|---|---|
| Repository and generated artifact | 2026-08-20 | Pass. All gates green at `49c9317`. |
| Production HTTP | 2026-08-20 | Pass against deployed `93feb3d`, spot-checked on `49c9317`. 24 of 24 sitemap URLs 200, canonical-exact, unique non-empty descriptions. |
| Google Search Console | 2026-08-20, Page indexing report dated 2026-08-16 | Five defects resolved. Two rows pending recrawl. |

Provider state at observation: 2 indexed, 8 not indexed, 10 known URLs against
24 declared targets. Both sitemaps now read Success on 2026-08-20 with 2 and 22
discovered pages, totalling the 24 canonical targets. Manual actions, security
issues, and HTTPS clean. Core Web Vitals insufficient field data on both device
types. No active validation batches.

Open items by class: two `pending recrawl` rows for `data-quality` URLs, one
`policy decision` on the assistant-guide surfaces, one `external limitation` on
Core Web Vitals, two deferred engineering tasks.

## Console action ledger

Read before opening a console. Only observed actions and observed confirmations.
An accepted request stays pending until a later report proves completion.
Preserve the original acceptance date; record later confirmations as new rows.

| Provider and property | Action and target | Accepted at | Confirmation | Result class | Repeat policy | Next review |
|---|---|---|---|---|---|---|
| GSC `sc-domain:knowledge-as-code.com` | Submit sitemap `https://knowledge-as-code.com/demo/sitemap.xml` (first submission) | 2026-08-20 | Toast "Sitemap submitted successfully"; row Submitted 2026-08-20, Last read 2026-08-20, Status Success, Discovered pages 22 | Accepted | Do not resubmit. Only on a future material revision Google has not read. | Pages report on or after 2026-08-27 |
| GSC `sc-domain:knowledge-as-code.com` | Refresh sitemap `https://knowledge-as-code.com/sitemap.xml`, last read 2026-04-17, predating the 2026-07-25 and 2026-08-20 revisions | 2026-08-20 | Toast "Sitemap submitted successfully"; row Submitted 2026-08-20, Last read 2026-08-20, Status Success, Discovered pages 2 | Accepted | Do not resubmit merely because status reads Success. | Pages report on or after 2026-08-27 |
| GSC `sc-domain:knowledge-as-code.com` | Submit sitemap using bare path `demo/sitemap.xml` | not accepted | Error "Invalid sitemap address. Please enter a valid path to a sitemap in your site." | Rejected | Superseded. Domain properties require the full URL including scheme. | none |

No URL Inspection was performed and no indexing request was submitted on this
property. That is `not performed`, not zero.

## Do not repeat

- Both accepted sitemap submissions above. Current as of 2026-08-20.
- Do not start "Validate fix" on `Page with redirect`, `Not found (404)`, `Alternate page with proper canonical tag`, or `Crawled - currently not indexed`. As of 2026-08-20 every row in all four groups is expected noise or an intended 404. Validating them asks Google to confirm behaviour that is already correct.
- Do not request indexing for machine surfaces, raw `.md` source, or retired routes.
- Do not re-add `/demo/` to the root sitemap.
- Do not treat the skipped `pages.yml` run as a deployment failure.
- Do not pair with `web-perf` on the strength of the Core Web Vitals "not enough usage data" message alone.

## Known expected noise

Rows that will keep appearing and are not defects:
- `http://knowledge-as-code.com/`, `http://www.knowledge-as-code.com/`, `https://www.knowledge-as-code.com/` under `Page with redirect`. A domain property covers every host and scheme variant; the redirects are correct.
- `/index.html` under `Alternate page with proper canonical tag`. It canonicalizes to `/` by design.
- `/data/examples/**.md` under `Crawled - currently not indexed`. Raw source is published deliberately and is not an index target.
- Core Web Vitals reporting insufficient field data. A traffic-volume limitation.

## Next review

Trigger, not a schedule. Re-open on the earliest of:
- the Pages report advancing beyond 2026-08-16, expected on or after 2026-08-27
- either sitemap's Last read advancing beyond 2026-08-20
- either `data-quality` URL leaving the indexed or crawled set
- a `/demo/` URL entering the known set, which is the success signal for both accepted submissions
- GSC naming a new error, manual action, or security issue
- a material deployment to `main`
- any repository or production gate failing

At that review, confirm the two accepted submissions produced discovery before
considering any further console action.

## Deferred work

### Repository search contract

No offline or production search contract exists here. All five defects fixed on
2026-08-20 were found by hand and would have been caught deterministically by
one.

The skill ships v4 templates and a scaffolder. Treat the skill as read-only and
run its scaffolder from its installed location:

```bash
node ~/.claude/skills/portfolio-search-indexing-audit/scripts/scaffold-search-contract.mjs --repo="$PWD" --origin=https://knowledge-as-code.com/ --output=demo
```

Then configure for this repository's split layout, which the default scaffold
does not anticipate:
- Two sitemaps, not one. `outputDir` should point at `demo/`, and the hand-written root landing needs its own assertions.
- Expected 404s: `/docs/`, the retired root routes, and both `data-quality` paths.
- Required machine surfaces: `/.well-known/assistant-guide.txt`, `/llms.txt`, `/demo/agents.json`, `/demo/api/v1/index.json`.
- Do not require JSON-LD globally. Today only the landing page has it. Require it on `/` only, until the bridge-page work below lands.

Minimum assertions, being exactly those that would have caught this round:
1. Every sitemap page has a `rel=canonical` exactly equal to its sitemap `loc`. This one matters most: the home page regressed precisely because an empty path is falsy.
2. Every sitemap page has a non-empty `meta description`.
3. Descriptions are unique across sitemap pages.
4. No URL appears in more than one sitemap.
5. Every noindex page is absent from every sitemap.

Wire only the offline check into `build.yml`. Keep the production check
release-triggered. Note the repository-wide validators: `scripts/eval.js` and
`validate-hashes.sh` inspect tracked files, so stage new files with `git add -N`
before rerunning them, and update `MANIFEST.yaml` with
`./scripts/validate-hashes.sh --update` after changing any hashed file.

### JSON-LD on bridge pages

`renderBridgeShell` in `scripts/build.js` already accepts a `structuredData`
parameter and renders it into an `application/ld+json` block. No caller passes
one, so all 22 demo pages ship without structured data while the landing page
carries `TechArticle` and `DefinedTerm`.

Candidate mappings, one per bridge generator:
- container detail: `Dataset` or `CreativeWork`, with `dateModified` from the container timeline.
- primary detail: `DefinedTerm` inside a `DefinedTermSet` for the reference as a whole.
- requires bridge: `Question` and `Answer`. These pages already read as "Does X require Y? Yes." and are the strongest rich-result candidates in the tree.
- compare bridge: `ItemList` of the two containers compared.
- authority detail: `Organization`.

If this lands, add a contract assertion that every sitemap page contains
parseable JSON-LD, and align `dateModified` with sitemap `lastmod` on the exact
routes where both exist.
