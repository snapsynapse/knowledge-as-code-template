# Search indexing policy and status

Living document for the search posture of https://knowledge-as-code.com/.
Property-specific. Method lives in the `portfolio-search-indexing-audit` skill,
not here.

Last full audit: 2026-08-20.

## Property

| Field | Value |
|---|---|
| Canonical origin | https://knowledge-as-code.com/ |
| Google Search Console property | `sc-domain:knowledge-as-code.com` |
| Hosting | GitHub Pages, serving `main` branch root |
| Deploy trigger | push to `main` (the `pages build and deployment` run, not `pages.yml`) |
| Bing Webmaster Tools | not configured |

`pages.yml` is gated `if: github.repository != 'snapsynapse/knowledge-as-code-template'`
and never runs here. It exists for template forks, which build and deploy `docs/`.

## Index policy

This matrix decides whether a console row is a defect or expected noise.

| Class | Members |
|---|---|
| Canonical HTML index targets | `/` (landing), the 22 pages in `demo/sitemap.xml` |
| Intentional noindex | `/404.html`, `/demo/404.html` |
| Crawlable machine surfaces, not index targets | `robots.txt`, both sitemaps, `/llms.txt`, `/demo/llms.txt`, `/demo/agents.json`, `/demo/index.xml`, `/demo/api/v1/*.json`, `/data/examples/**.md`, `/assistant-guide.txt`, `/.well-known/assistant-guide.txt` |
| Expected redirects | `www` to bare, `http` to `https` |
| Expected 404 | `/docs/` (local build output, gitignored, never deployed), all pre-consolidation root routes, all `data-quality` routes |

Two sitemaps, no overlap. `/sitemap.xml` owns the landing and the assistant
guide. `demo/sitemap.xml` owns the entire demo tree and is the single source of
truth for it, including `/demo/` itself. Do not re-add `/demo/` to the root
sitemap: two entries for one URL drift apart and did.

Retired route history, for reading old console rows:
- `d61d585` moved the built site from the repository root into `/demo/`. Every bare root route such as `/containers.html` or `/primary/<id>/` has 404ed since.
- `b10f2d6` replaced the `data-quality` entity with `information-integrity`. Both `/primary/data-quality/` and `/demo/primary/data-quality/` 404 and should stay that way.

## Deferred work

### Repository search contract

No offline or production search contract exists in this repository. All five
defects fixed on 2026-08-20 were found by hand and would have been caught
deterministically by one.

Scaffold with the skill's v4 templates:

```bash
node scripts/scaffold-search-contract.mjs --repo="$PWD" --origin=https://knowledge-as-code.com/ --output=demo
```

Then configure for this repository's split layout, which the default scaffold
does not anticipate:
- Two sitemaps, not one. The landing site is hand-written at the repository root and the demo is generated into `demo/`. `outputDir` should point at `demo/`, and the root landing needs its own assertions.
- Expected 404s: `/docs/`, the retired root routes, and both `data-quality` paths.
- Required machine surfaces: `/.well-known/assistant-guide.txt`, `/llms.txt`, `/demo/agents.json`, `/demo/api/v1/index.json`.
- Do not require JSON-LD globally. Today only the landing page has it. Require it on `/` only, until the bridge-page work below lands.

Assertions that would have caught the 2026-08-20 defects, and so are the
minimum bar:
1. Every sitemap page has a `rel=canonical` exactly equal to its sitemap `loc`. This is the one that matters most: the home page regressed precisely because an empty path is falsy.
2. Every sitemap page has a non-empty `meta description`.
3. Descriptions are unique across sitemap pages.
4. No URL appears in more than one sitemap.
5. Every noindex page is absent from every sitemap.

Wire only the offline check into `build.yml`. Keep the production check
release-triggered. `BUILD_DAY` is derived from the maximum container date rather
than wall clock, so the generated output is reproducible and safe to diff in CI.

### JSON-LD on bridge pages

`renderBridgeShell` in `scripts/build.js` already accepts a `structuredData`
parameter and renders it into a `application/ld+json` block. No caller passes
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

## Action ledger

One row per authenticated console action. Never repeat an accepted row without a
new material reason.

| Date | Property | Action and target | Observed confirmation | Result class | Repeat policy | Next review |
|---|---|---|---|---|---|---|
| 2026-08-20 | `sc-domain:knowledge-as-code.com` | Submit sitemap `https://knowledge-as-code.com/demo/sitemap.xml` (first submission) | Toast "Sitemap submitted successfully"; table row Submitted 2026-08-20, Last read 2026-08-20, Status Success, Discovered pages 22 | Accepted | Do not resubmit. Only on a future material revision that Google has not read. | Re-read Pages report 2026-08-27 |
| 2026-08-20 | `sc-domain:knowledge-as-code.com` | Refresh sitemap `https://knowledge-as-code.com/sitemap.xml` (last read 2026-04-17 predated the 2026-07-25 and 2026-08-20 revisions) | Toast "Sitemap submitted successfully"; table row Submitted 2026-08-20, Last read 2026-08-20, Status Success, Discovered pages 2 | Accepted | Do not resubmit merely because status reads Success. | Re-read Pages report 2026-08-27 |

A first attempt at the demo sitemap using the bare path `demo/sitemap.xml` was
rejected with "Invalid sitemap address". Domain properties require the full URL
including scheme. Not an error state, recorded so the next operator skips it.

## Do not repeat

- Both sitemap submissions above. Both are current as of 2026-08-20.
- Do not start "Validate fix" on `Page with redirect`, `Not found (404)`, `Alternate page with proper canonical tag`, or `Crawled - currently not indexed`. As of 2026-08-20 every row in all four groups is expected noise or an intended 404. Validating them asks Google to confirm behaviour that is already correct.
- Do not request indexing for machine surfaces, raw `.md` source, or retired routes.
- Do not add `/demo/` back to the root sitemap.

## Known expected noise

Rows that will keep appearing and should not be treated as defects:
- `http://knowledge-as-code.com/`, `http://www.knowledge-as-code.com/`, `https://www.knowledge-as-code.com/` under `Page with redirect`. A domain property covers every host and scheme variant; the redirects are correct.
- `/index.html` under `Alternate page with proper canonical tag`. It canonicalizes to `/` by design.
- `/data/examples/**.md` under `Crawled - currently not indexed`. Raw source is published deliberately for the landing page's source links and is not an index target.
- Core Web Vitals reporting "not enough usage data". This is a traffic-volume limitation, not a performance defect. Do not pair with `web-perf` on the strength of it alone.

## Evidence

Dated observations under `ops/search/GoogleSearchConsole/<date>/`. Console
exports are not committed: this repository is public, and exports carry account
identity and private query data.
