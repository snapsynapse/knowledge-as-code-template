# Google Search Console observations, 2026-08-20

Property `sc-domain:knowledge-as-code.com`. Captured 2026-08-20 from the console
UI. No exports were downloaded. Query-level and account-identifying data are
deliberately excluded because this repository is public.

Property identity was verified before any read: `resource_id` in the URL, the
visible property selector, and the URL-inspection placeholder all read
`knowledge-as-code.com`. A stale accessible label from a previously viewed
property was present on the inspect combobox, so every report was hard-navigated
rather than read from SPA state.

## Report freshness

| Report | Last update reported by console |
|---|---|
| Page indexing | 2026-08-16 |
| Performance | 2026-08-18 |
| HTTPS | 2026-08-18 |
| Core Web Vitals | 2026-08-18 |

## Page indexing, before the fixes

Indexed 2, not indexed 8, across 10 known URLs. The site declares 24 canonical
targets, so 14 were not known to Google at all.

| Reason | Count | Examples | Class |
|---|---|---|---|
| Page with redirect | 3 | `http://knowledge-as-code.com/`, `http://www.knowledge-as-code.com/`, `https://www.knowledge-as-code.com/` | Expected noise |
| Crawled, currently not indexed | 3 | `/data/examples/organizations/iso.md`; `/containers.html`; `/primary/incident-response/index.html` | 1 expected noise, 2 stale rows for routes retired in `d61d585` |
| Not found (404) | 1 | `/primary/data-quality/index.html` | Expected noise, doubly retired |
| Alternate page with proper canonical tag | 1 | `/index.html` | Expected noise |
| Indexed | 2 | `/`; `/demo/primary/data-quality/index.html` | 1 correct, 1 defect |

All four not-indexed groups showed `Validation: Not Started`. No validation
batch was active on this property.

Defect: the only indexed page in the demo tree was
`/demo/primary/data-quality/index.html`, which returns 404. Verified directly.
No live demo page was indexed.

## Sitemaps, before the fixes

| Sitemap | Submitted | Last read | Status | Discovered pages |
|---|---|---|---|---|
| `https://knowledge-as-code.com/sitemap.xml` | 2026-04-09 | 2026-04-17 | Success | 1 |

`https://knowledge-as-code.com/demo/sitemap.xml` was not submitted. It was
advertised only through a `Sitemap:` directive in `robots.txt`, which had not
been picked up.

This is the root cause of the discovery gap. Google's copy of the root sitemap
was four months old and predated the 2026-07-25 revision, and the sitemap
containing all 22 demo pages had never been read.

## Sitemaps, after the 2026-08-20 submissions

| Sitemap | Submitted | Last read | Status | Discovered pages |
|---|---|---|---|---|
| `https://knowledge-as-code.com/sitemap.xml` | 2026-08-20 | 2026-08-20 | Success | 2 |
| `https://knowledge-as-code.com/demo/sitemap.xml` | 2026-08-20 | 2026-08-20 | Success | 22 |

2 plus 22 equals the 24 canonical targets. Both were read immediately on
submission.

## Performance, 90 days ending 2026-08-18

| Metric | Value |
|---|---|
| Clicks | 73 |
| Impressions | 578 |
| Average CTR | 12.6% |
| Average position | 6.4 |

Pages breakdown: `/` took 73 of 73 clicks and 577 of 578 impressions. The
remaining impressions went to the two `data-quality` URLs, both of which 404. No
live `/demo/` page had ever received an impression.

The property ranks on first page for its own term. Query detail is intentionally
not recorded here.

## Other reports

| Report | State |
|---|---|
| Manual actions | No issues detected |
| Security issues | No issues detected |
| HTTPS | 0 non-HTTPS URLs, no issues in 90 days |
| Core Web Vitals | Not enough usage data, mobile and desktop |

## Production verification, deployed commit `93feb3d`

Run after the Pages deployment completed and before any console action.

| Check | Result |
|---|---|
| Unique sitemap URLs | 24 |
| HTTP 200 | 24 of 24 |
| Redirects on sitemap URLs | 0 |
| Missing canonical | 0 |
| Canonical not equal to sitemap loc | 0 |
| Empty meta description | 0 |
| Duplicate meta description | 0 |
| Ancillary surfaces checked | 10, all 200 with correct content type |
| Negative routes returning 404 without redirect | 5 of 5 |
| Host redirects to bare HTTPS in one hop | 2 of 2 |

## Next review

2026-08-27 or later. Re-read the Pages report and confirm `/demo/*` URLs have
entered the known set. Expect the two `data-quality` rows to drop out as Google
recrawls them.
